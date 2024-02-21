import { Subject } from 'rxjs';
import * as io from 'socket.io-client';

export interface Message {
    channel: string;
    command: string;
    payload: unknown;
}

const messageSubject = new Subject<Message>();
export const Messages = messageSubject.asObservable();

let location = '';
if (typeof window !== 'undefined') {
    location = window.location.hostname || '';
}

var socket: io.Socket | null = null;

const init = (app: string, server?: string, port?: number) => {
    server ??= location;
    port ??= 9011;

    if (!server.startsWith('http')) {
        server = 'http://' + server;
    }

    server += `:${port}`;

    socket = io.io(server, {
        query: { app: app, version: '1' },
        autoConnect: false,
    });
    
    socket.connect();

    console.debug(`Connecting to colibri server on ${server}`);
    socket.on('connect', () => {
        console.log(`Connected to colibri server on ${server}`);
    });
    socket.on('error', (error: Error) => {
        console.log('Socket connection error:', error);
    });

    socket.onAny((channel, msg) => {
        // if (msg.command === 'rpcRequest') {
        //     const result = CallRpc(msg.channel, msg.payload['parameters']);
        //     socket.emit(msg.channel, {
        //         group: APP_NAME,
        //         command: 'rpcAnswer',
        //         payload: {
        //             result,
        //             rpcId: msg.payload['rpcId']
        //         }
        //     });
        // }
        //console.log('(Any) Received message:', channel, msg);
        messageSubject.next({
            channel,
            command: msg.command,
            payload: msg.payload,
        });
    });
};

export const Colibri = {
    init,
};

///////////////////////////
/// Default communication
///////////////////////////
export const SendMessage = (
    channel: string,
    command: string,
    payload: unknown = {}
) => {
    socket.emit(channel, {
        command,
        payload,
    });
};

///////////////////////////////////////////
/// Handlers (e.g. model synchronization)
///////////////////////////////////////////

export const RegisterChannel = (
    channel: string,
    handler: (payload: Message) => void
) => {
    socket.on(channel, handler);
};

export const UnregisterChannel = (
    channel: string,
    handler: (payload: Message) => void
) => {
    socket.off(channel, handler);
};

export const RegisterOnce = (
    channel: string,
    handler: (payload: Message) => void
) => {
    socket.once(channel, handler);
};

//////////////////
/// RPC
//////////////////
// type rpcMethod = (payload: unknown) => unknown;
// const rpcMethods: {[method: string]: rpcMethod } = {};
// export const RegisterRpc = (method: string, fn: rpcMethod): void => {
//     rpcMethods[method] = fn;
// };

// export const SendRpc = async (method: string, payload: any): Promise<any> => {
//     // TODO
//     return null;
// };

// const CallRpc = (method: string, payload: any): any => {
//     if (rpcMethods[method])
//         return rpcMethods[method](payload);
//     else {
//         console.error(`Unknown rpc method ${method}`);
//         return 'error';
//     }
// };

// for debugging
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// (window as any).SendMessage = SendMessage;
// messageSubject.subscribe(console.log);
