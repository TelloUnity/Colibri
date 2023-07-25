import * as net from 'net';
import * as _ from 'lodash';
import { WorkerService } from '../core';
import * as threads from 'worker_threads';
import { NetworkMessage } from 'modules/command-hooks';


export const UNITY_SERVER_WORKER = __filename;

interface TcpClient {
    id: string;
    socket: net.Socket;
    leftOverBuffer: string;
    address: string;
    app: string;
}

export class UnityServerWorker extends WorkerService {
    private server!: net.Server;

    // waiting for client to specify app name
    private readonly waitingClients: TcpClient[] = [];
    // properly connected clients
    private readonly clients: TcpClient[] = [];

    private heartbeatInterval!: NodeJS.Timer;
    private idCounter = 0;

    public constructor() {
        super(true);

        this.parentMessages$.subscribe(msg => {
            switch (msg.channel) {
                case 'm:start':
                    this.start(msg.content.port as number);
                    break;

                case 'm:stop':
                    this.stop();
                    break;

                case 'm:broadcast': {
                    const ids = msg.content.clients as string[];
                    const clients = ids
                        .map(id => this.clients.find(c => c.id === id))
                        .filter((c): c is TcpClient => !!c);

                    this.broadcast(msg.content.msg as NetworkMessage, clients);
                    break;
                }
            }
        });
    }

    public start(port: number): void {
        this.server = net.createServer((socket) => this.handleConnection(socket));
        this.server.listen(port);

        this.logInfo(`Starting Unity server on *:${port}`);
        this.heartbeatInterval = setInterval(() => this.handleHeartbeat(), 100);
    }

    public stop(): void {
        this.server.close();
        clearInterval(this.heartbeatInterval);
    }



    public broadcast(msg: NetworkMessage, clients: ReadonlyArray<TcpClient>): void {
        if (clients.length === 0) {
            return;
        }

        const msgString = JSON.stringify(msg);
        const msgBytes = this.toUTF8Array(msgString);

        for (const client of clients) {
            // message format:
            // \0\0\0(PacketHeader)\0(ActualMessage)
            const tcpClient = client;
            tcpClient.socket.write('\0\0\0' + msgBytes.length.toString() + '\0');
            tcpClient.socket.write(msgString);
        }

    }

    private handleConnection(socket: net.Socket): void {
        const id = (++this.idCounter).toString();
        this.logDebug(`New unity client (${id}) connected from ${socket.remoteAddress}, waiting for app name`);
        socket.setNoDelay(true);

        const tcpClient: TcpClient = {
            id,
            socket,
            leftOverBuffer: '',
            address: socket.remoteAddress || 'UNDEFINED',
            app: ''
        };
        this.waitingClients.push(tcpClient);

        socket.on('data', (data) => {
            this.handleSocketData(tcpClient, data);
        });

        socket.on('error', (error) => {
            this.handleSocketError(tcpClient, error);
        });

        socket.on('end', () => {
            this.handleSocketDisconnect(tcpClient);
        });
    }

    private handleSocketData(client: TcpClient, data: Buffer): void {
        const msgs = this.splitJson(data.toString(), client);

        for (const msg of msgs) {
            try {
                const packet = JSON.parse(msg);
                if (packet.command === 'set_app') {
                    this.assignApp(client, (packet.payload as { name: string }).name as string);
                } else if (client.app) {
                    packet.origin = { id: client.id, app: client.app };
                    this.postMessage('clientMessage$', packet);
                } else {
                    this.logError(`Ignoring message (${packet.channel} / ${packet.command}) from client ${client.id} without app`);
                }
            } catch (err) {
                if (err instanceof Error) {
                    this.logError(err.message);
                }

                this.logError(msg);
            }
        }
    }

    private assignApp(client: TcpClient, app: string): void {
        this.logDebug(`Setting app of unity client "${client.id}" to "${app}"`);
        client.app = app;
        _.pull(this.waitingClients, client);
        this.clients.push(client);
        this.postMessage('clientConnected$', { id: client.id, app });
    }


    private handleSocketError(client: TcpClient, error: Error): void {
        this.logError(error.message);
        this.handleSocketDisconnect(client);
    }

    private handleSocketDisconnect(client: TcpClient): void {
        this.logDebug(`Unity client ${client.address} disconnected`);
        _.pull(this.clients, client);
        _.pull(this.waitingClients, client);
        this.postMessage('clientDisconnected$', { id: client.id });
    }


    private handleHeartbeat() {
        for (const client of this.clients) {
            client.socket.write('\0\0\0h\0');
        }

        for (const client of this.waitingClients) {
            client.socket.write('\0\0\0h\0');
        }
    }




    // adapted from http://stackoverflow.com/a/18729931
    private toUTF8Array(str: string): number[] {
        const utf8: number[] = [];

        for (let i = 0; i < str.length; i++) {
            let charcode = str.charCodeAt(i);
            if (charcode < 0x80) { utf8.push(charcode); } else if (charcode < 0x800) {
                // tslint:disable-next-line:no-bitwise
                utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
            } else if (charcode < 0xd800 || charcode >= 0xe000) {
                // tslint:disable-next-line:no-bitwise
                utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
            } else {
                i++;
                // UTF-16 encodes 0x10000-0x10FFFF by
                // subtracting 0x10000 and splitting the
                // 20 bits of 0x0-0xFFFFF into two halves
                // tslint:disable-next-line:no-bitwise
                charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                // tslint:disable-next-line:no-bitwise
                utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
            }
        }
        return utf8;
    }




    // TODO: breaks easily, but sufficient for current purpose
    // TODO: see equivalent implementation in unity listener InteractiveSurfaceClient.cs
    private splitJson(text: string, client: TcpClient): string[] {
        const jsonPackets: string[] = [];

        let leftBracketIndex = -1;
        let rightBracketIndex = -1;

        let bracketCounter = 0;
        let startPos = 0;

        const fullText = client.leftOverBuffer ? client.leftOverBuffer + text : text;

        for (let i = 0; i < fullText.length; i++) {
            const ch = fullText.charAt(i);

            if (ch === '{') {
                if (bracketCounter === 0) {
                    leftBracketIndex = i;
                }

                bracketCounter++;
            } else if (ch === '}') {
                bracketCounter--;

                if (bracketCounter <= 0) {
                    rightBracketIndex = i;
                    bracketCounter = 0;

                    jsonPackets.push(fullText.substring(leftBracketIndex, rightBracketIndex + 1));
                    startPos = i + 1;
                }
            }
        }

        if (startPos < fullText.length) {
            client.leftOverBuffer = fullText.substring(startPos);
        } else {
            client.leftOverBuffer = '';
        }

        return jsonPackets;
    }
}


if (!threads.isMainThread) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const server = new UnityServerWorker();
}
