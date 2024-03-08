import { Colibri, RegisterModelSync, SyncModel, Synced, ModelSyncRegistration, RegisterModelSyncInstances } from '@hcikn/colibri';
//import { rl, colibriAddress } from './common';
//import { Observable } from 'rxjs';
import { SyncRobot, SyncPath, SyncManager } from './robot-sync';
import * as net from 'net';
//import { v4 as uuidv4 } from 'uuid';
//const robots: SyncRobot[] = [];

var pepper: SyncRobot | null = null;
var clients: net.Socket[] = [];
var clientsActive: boolean[] = [];

const server = net.createServer((socket) => {
    //const id = uuidv4();
    clients.push(socket);
    clientsActive.push(false);
    console.log(`New client connected from ${socket.remoteAddress}`);
    //if (pepper != null) {
    //    socket.write(JSON.stringify({ type: "robot", robot_id: pepper.robot_id, position: pepper.position, rotation: pepper.rotation }));
    //}

    socket.on('data', (data) => {
        console.log(data.toString());
        if (data.toString().search('hello from colibri_interface') !== -1) {
            console.log('setting client active', clients.indexOf(socket));
            clientsActive[clients.indexOf(socket)] = true;
            if(pepper != null) {
                socket.write(JSON.stringify({ type: "robot", robot_id: pepper.robot_id, position: pepper.position, rotation: pepper.rotation }));
            }
        }

        //var answer = { type: "path", points: [[0.5, 0.5, 0 ], [1, 0, 0]] };
        //socket.write(JSON.stringify(answer));
        return;
        try {
            const jsonData = JSON.parse(data.toString());
            const robotId = jsonData.robot_id;
            const matchingRobot = robots.find(robot => robot.robot_id === robotId);
            if (matchingRobot) {
                matchingRobot.position = [jsonData.x, jsonData.y, jsonData.z];
            } else {
                const robot = new SyncRobot(robotId);
                robot.robot_id = robotId;
                robot.position = [jsonData.x, jsonData.y, jsonData.z];
                robot.rotation = [0, 0, 0, 1];
                robots.push(robot);
                if (managerRobots != null) {
                    managerRobots.registerNewObject(robot);
                }
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
        
    });

    socket.on('end', () => {
        console.log('client disconnected');
      });
});

server.listen(1709, '172.20.24.112', () => {
    console.log('Server listening on port 1709');
});

var managerRobots: SyncManager<SyncRobot> | null = null;

(async () => {
    Colibri.init('TelloUnity', "172.20.24.2", 9011);

    /**
     *  This is the registration for the SampleClass.
     *  It returns an observable (BehaviorSubject) that contains all instances of SampleClass and a function to register new instances.
     */
    //var managerPath = new SyncManager<SyncPath>({ type: SyncPath, model_id: 'paths_vr' });
    //managerPath.registerManager();
    
    managerRobots = new SyncManager<SyncRobot>({ type: SyncRobot, model_id: 'pepper' });
    managerRobots.newObjectUpdate = (id) => {
        if (id !== "") {
            // new object
            var robot = managerRobots?.getInstance(id);
            console.log('New robot appeared:', robot?.robot_id);
            if (robot?.robot_id === 'pepper') {
                pepper = robot;
            }
        } 
        if (pepper != null) {
            console.log('Pepper update:');
            for (var i = 0; i < clients.length; i++) {
                if (clientsActive[i]) {
                    console.log('Sending pepper to client');
                    clients[i].write(JSON.stringify({ type: "robot", robot_id: pepper.robot_id, position: pepper.position, rotation: pepper.rotation }));
                }
            }
        }
    }
})();

