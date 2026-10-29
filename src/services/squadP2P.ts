import Peer, { DataConnection } from 'peerjs';
import {
  P2PMessage,
  SquadMember,
  TacticalPing,
  WhitelistedDevice,
} from '../types/radar';
import {
  decryptSquadMessage,
  deriveSquadAesKey,
  deriveStealthRoomPeerId,
  encryptSquadMessage,
} from './crypto';

export type SquadConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED_HOST'
  | 'CONNECTED_PEER'
  | 'ERROR';

interface SquadP2PCallbacks {
  onStatusChange: (status: SquadConnectionStatus, info?: string) => void;
  onRosterChange: (members: SquadMember[]) => void;
  onWhitelistChange: (whitelist: WhitelistedDevice[]) => void;
  onPingsChange: (pings: TacticalPing[]) => void;
}

export class SquadP2PService {
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private clientConnections = new Map<string, DataConnection>();
  private broadcastChannel: BroadcastChannel | null = null;

  private isHost = false;
  private roomCode = '';
  private aesKey: CryptoKey | null = null;
  private stealthPeerId = '';
  private selfMember: SquadMember;
  private members = new Map<string, SquadMember>();
  private whitelist = new Map<string, WhitelistedDevice>();
  private pings = new Map<string, TacticalPing>();
  private callbacks: SquadP2PCallbacks;

  constructor(initialSelf: SquadMember, callbacks: SquadP2PCallbacks) {
    this.selfMember = initialSelf;
    this.members.set(initialSelf.peerId, initialSelf);
    this.callbacks = callbacks;
  }

  public getSelfPeerId(): string {
    return this.selfMember.peerId;
  }

  public getStealthPeerId(): string {
    return this.stealthPeerId;
  }

  /**
   * Connects to a Squad Room using SHA-256 stealth room ID derivation
   * and AES-256-GCM end-to-end payload encryption.
   */
  public async connectToRoom(
    rawRoomCode: string,
    callsign: string,
    squadPin = '0451'
  ) {
    this.disconnect();

    const cleanCode = rawRoomCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '');
    if (!cleanCode) return;

    const effectivePin = squadPin.trim() || '0000';
    this.roomCode = cleanCode;
    this.selfMember = {
      ...this.selfMember,
      callsign: callsign.trim().toUpperCase() || 'ALPHA-1',
      lastUpdated: Date.now(),
    };
    this.members.clear();
    this.members.set(this.selfMember.peerId, this.selfMember);
    this.emitRoster();

    this.callbacks.onStatusChange(
      'CONNECTING',
      `Deriving AES-256 key & stealth ID for ${cleanCode}...`
    );

    try {
      const [hostPeerId, derivedKey] = await Promise.all([
        deriveStealthRoomPeerId(cleanCode, effectivePin),
        deriveSquadAesKey(cleanCode, effectivePin),
      ]);
      this.stealthPeerId = hostPeerId;
      this.aesKey = derivedKey;

      // 1. Setup same-device BroadcastChannel on the stealth channel ID
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel(hostPeerId);
        this.broadcastChannel.onmessage = async (ev) => {
          if (ev.data && this.aesKey) {
            const decrypted = await decryptSquadMessage(ev.data, this.aesKey);
            if (decrypted) {
              this.handleIncomingMessage(decrypted);
            }
          }
        };
      }

      // 2. Setup PeerJS WebRTC connection using the SHA-256 stealth ID
      const candidateHost = new Peer(hostPeerId);

      candidateHost.on('open', () => {
        this.peer = candidateHost;
        this.isHost = true;
        this.callbacks.onStatusChange(
          'CONNECTED_HOST',
          `E2EE Host active (${cleanCode} • AES-256-GCM)`
        );
        void this.sendMessage({
          type: 'MEMBER_UPDATE',
          member: this.selfMember,
        });
      });

      candidateHost.on('connection', (conn) => {
        this.setupHostClientConnection(conn);
      });

      candidateHost.on('error', (err: { type?: string; message?: string }) => {
        if (err.type === 'unavailable-id') {
          // Stealth room host already exists! Connect as a Squad Peer Client
          candidateHost.destroy();
          this.connectAsClient(hostPeerId, cleanCode);
        } else {
          this.callbacks.onStatusChange(
            'ERROR',
            `WebRTC signaling notice: ${err.message || 'Check network'}`
          );
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks.onStatusChange('ERROR', `Crypto init failed: ${msg}`);
    }
  }

  private connectAsClient(hostPeerId: string, cleanCode: string) {
    const clientPeer = new Peer();
    this.peer = clientPeer;
    this.isHost = false;

    clientPeer.on('open', () => {
      const conn = clientPeer.connect(hostPeerId, { reliable: true });
      this.hostConnection = conn;

      conn.on('open', async () => {
        this.callbacks.onStatusChange(
          'CONNECTED_PEER',
          `E2EE Linked to ${cleanCode} (AES-256-GCM)`
        );
        if (this.aesKey) {
          const env = await encryptSquadMessage(
            {
              type: 'MEMBER_UPDATE',
              member: this.selfMember,
            },
            this.aesKey
          );
          conn.send(env);
        }
      });

      conn.on('data', async (data) => {
        if (!this.aesKey) return;
        const decrypted = await decryptSquadMessage(data, this.aesKey);
        if (decrypted) {
          this.handleIncomingMessage(decrypted);
        }
      });

      conn.on('close', () => {
        this.callbacks.onStatusChange(
          'DISCONNECTED',
          `Disconnected from Squad ${cleanCode}`
        );
      });
    });

    clientPeer.on('error', (err) => {
      this.callbacks.onStatusChange(
        'ERROR',
        `Peer link error: ${err.message}`
      );
    });
  }

  private setupHostClientConnection(conn: DataConnection) {
    this.clientConnections.set(conn.peer, conn);

    conn.on('open', async () => {
      if (!this.aesKey) return;
      const syncMsg: P2PMessage = {
        type: 'ROSTER_SYNC',
        members: Array.from(this.members.values()),
        whitelist: Array.from(this.whitelist.values()),
        pings: Array.from(this.pings.values()),
      };
      const env = await encryptSquadMessage(syncMsg, this.aesKey);
      conn.send(env);
    });

    conn.on('data', async (data) => {
      if (!this.aesKey) return;
      const msg = await decryptSquadMessage(data, this.aesKey);
      if (msg) {
        this.handleIncomingMessage(msg, conn.peer);
      }
    });

    conn.on('close', () => {
      this.clientConnections.delete(conn.peer);
    });
  }

  private handleIncomingMessage(msg: P2PMessage, fromPeer?: string) {
    switch (msg.type) {
      case 'MEMBER_UPDATE': {
        this.members.set(msg.member.peerId, msg.member);
        this.emitRoster();
        if (this.isHost) {
          void this.relayToClients(msg, fromPeer);
        }
        break;
      }
      case 'ROSTER_SYNC': {
        for (const m of msg.members) {
          this.members.set(m.peerId, m);
        }
        this.members.set(this.selfMember.peerId, this.selfMember);
        for (const w of msg.whitelist) {
          this.whitelist.set(w.deviceId, w);
        }
        for (const p of msg.pings) {
          this.pings.set(p.id, p);
        }
        this.emitRoster();
        this.emitWhitelist();
        this.emitPings();
        break;
      }
      case 'TACTICAL_PING': {
        this.pings.set(msg.ping.id, msg.ping);
        this.emitPings();
        if (this.isHost) {
          void this.relayToClients(msg, fromPeer);
        }
        break;
      }
      case 'PING_REMOVE': {
        this.pings.delete(msg.pingId);
        this.emitPings();
        if (this.isHost) {
          void this.relayToClients(msg, fromPeer);
        }
        break;
      }
      case 'PINGS_CLEAR': {
        this.pings.clear();
        this.emitPings();
        if (this.isHost) {
          void this.relayToClients(msg, fromPeer);
        }
        break;
      }
      case 'WHITELIST_ADD': {
        this.whitelist.set(msg.entry.deviceId, msg.entry);
        this.emitWhitelist();
        if (this.isHost) {
          void this.relayToClients(msg, fromPeer);
        }
        break;
      }
      case 'WHITELIST_REMOVE': {
        this.whitelist.delete(msg.deviceId);
        this.emitWhitelist();
        if (this.isHost) {
          void this.relayToClients(msg, fromPeer);
        }
        break;
      }
    }
  }

  public updateSelfState(partial: Partial<SquadMember>) {
    this.selfMember = {
      ...this.selfMember,
      ...partial,
      lastUpdated: Date.now(),
    };
    this.members.set(this.selfMember.peerId, this.selfMember);
    this.emitRoster();

    const msg: P2PMessage = {
      type: 'MEMBER_UPDATE',
      member: this.selfMember,
    };
    void this.sendMessage(msg);
  }

  public sendTacticalPing(ping: TacticalPing) {
    this.pings.set(ping.id, ping);
    this.emitPings();
    void this.sendMessage({
      type: 'TACTICAL_PING',
      ping,
    });
  }

  public removeTacticalPing(pingId: string) {
    this.pings.delete(pingId);
    this.emitPings();
    void this.sendMessage({
      type: 'PING_REMOVE',
      pingId,
    });
  }

  public clearAllPings() {
    this.pings.clear();
    this.emitPings();
    void this.sendMessage({
      type: 'PINGS_CLEAR',
    });
  }

  public addWhitelistedDevice(entry: WhitelistedDevice) {
    this.whitelist.set(entry.deviceId, entry);
    this.emitWhitelist();
    void this.sendMessage({
      type: 'WHITELIST_ADD',
      entry,
    });
  }

  public removeWhitelistedDevice(deviceId: string) {
    this.whitelist.delete(deviceId);
    this.emitWhitelist();
    void this.sendMessage({
      type: 'WHITELIST_REMOVE',
      deviceId,
    });
  }

  public pruneExpiredPings() {
    const now = Date.now();
    let changed = false;
    for (const [id, ping] of this.pings.entries()) {
      if (now > ping.expiresAt) {
        this.pings.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.emitPings();
    }
  }

  private async sendMessage(msg: P2PMessage) {
    if (!this.aesKey) return;
    const env = await encryptSquadMessage(msg, this.aesKey);
    try {
      this.broadcastChannel?.postMessage(env);
    } catch {
      // ignore
    }

    if (this.isHost) {
      await this.relayToClients(msg);
    } else if (this.hostConnection?.open) {
      this.hostConnection.send(env);
    }
  }

  private async relayToClients(msg: P2PMessage, excludePeer?: string) {
    if (!this.aesKey) return;
    const env = await encryptSquadMessage(msg, this.aesKey);
    for (const [peerId, conn] of this.clientConnections.entries()) {
      if (peerId !== excludePeer && conn.open) {
        conn.send(env);
      }
    }
  }

  public disconnect() {
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }
    for (const conn of this.clientConnections.values()) {
      conn.close();
    }
    this.clientConnections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.isHost = false;
    this.aesKey = null;
    this.callbacks.onStatusChange('DISCONNECTED');
  }

  private emitRoster() {
    this.callbacks.onRosterChange(Array.from(this.members.values()));
  }

  private emitWhitelist() {
    this.callbacks.onWhitelistChange(Array.from(this.whitelist.values()));
  }

  private emitPings() {
    this.callbacks.onPingsChange(Array.from(this.pings.values()));
  }
}
