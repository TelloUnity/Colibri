import { Colibri, RegisterModelSync, SyncModel, Synced, ModelSyncRegistration, RegisterModelSyncInstances } from '@hcikn/colibri';
import { rl, colibriAddress } from './common';
import { Observable } from 'rxjs';


/**
 *  To use the @Synced() decorator, please add the following to the "compiler" field of your tsconfig.json:
 *  "experimentalDecorators": true
 */
export class SyncPath extends SyncModel<SyncPath> {
    @Synced()
    get position() { return this._position; }
    set position(val: number[]) { this._position = val; }
    private _position = [0, 0, 0];

    /* Warning: for some reason syncing fields does not work with some frameworks (e.g., React)! */
    @Synced()
    get rotation() { return this._rotation; }
    set rotation(val: number[]) { this._rotation = val; }
    private _rotation = [0, 0, 0, 0];

    // We can provide a custom name for the synced property
    @Synced()
    get owner() { return this._owner; }
    set owner(val: string) { this._owner = val; }
    private _owner = '';

    @Synced()
    get path() { return this._path; }
    set path(val: number[][]) { this._path = val; }
    private _path = [] as number[][];

    toObj() {
        return { id: this.id, position: this.position, rotation: this.rotation, owner: this.owner, path: this.path };
    }
    
}

export class SyncRobot extends SyncModel<SyncRobot> {
    @Synced()
    get position() { return this._position; }
    set position(val: number[]) { this._position = val; }
    private _position = [0, 0, 0];

    @Synced()
    get rotation() { return this._rotation; }
    set rotation(val: number[]) { this._rotation = val; }
    private _rotation = [0, 0, 0, 0];

    @Synced()
    get robot_id() { return this._robot_id; }
    set robot_id(val: string) { this._robot_id = val; }
    private _robot_id = '';

    toObj() {
        return { id: this.id, position: this.position, rotation: this.rotation, robot_id: this.robot_id };
    }
}

class SyncManager<T extends SyncModel<T>>  {

    public sampleClasses$: Observable<T[]> | undefined;

    public registerNewObject: ((model: T) => void) = (model: T) => {};

    public getInstance: ((id: string) => T | undefined) = (id: string) => { return undefined; };

    constructor(modelRegistration: ModelSyncRegistration<T>) {
        const [ SampleClasses$, registerExampleClass, getObjectInstance ] = RegisterModelSyncInstances<T>(modelRegistration);

        this.registerNewObject = registerExampleClass;
        this.getInstance = getObjectInstance;

        this.sampleClasses$ = SampleClasses$;
        // SampleClasses$ contains all synchronized instances.
        // Since 'RegisterModelSync' returns a BehaviorSubject, the method will be executed with the current value.
        this.sampleClasses$.subscribe(classes => {
            // will be called whenever a new instance is created, an existing one is updated, or one is deleted
            // please refer to RxJS documentation for more information: https://rxjs.dev/guide/overview
            console.log(`Current ${modelRegistration.type.name}:`, classes.map(c => (c.toObj())));
        });
    }

}



(async () => {
    Colibri.init('TelloUnity', "localhost", 9011);

    /**
     *  This is the registration for the SampleClass.
     *  It returns an observable (BehaviorSubject) that contains all instances of SampleClass and a function to register new instances.
     */
    var managerPath = new SyncManager<SyncPath>({ type: SyncPath, model_id: 'paths_vr' });
    //managerPath.registerManager();

    var managerRobots = new SyncManager<SyncRobot>({ type: SyncRobot, model_id: 'robot_vr' });

    // When creating a new instance, we need to register it with the model synchronization
    //const newClass = new SyncRobot('test2');
    //managerRobots.registerNewObject(newClass);

    // models can be deleted by calling the delete method
    // newClass.delete();

    const sendNumber = () => {
        return new Promise((res) => {
            rl.question('> ', (answer) => {
                if (answer === 'exit') {
                    rl.close();
                    process.exit();
                } else {
                    try {
                        eval(answer);
                    } catch (e) {
                        console.error(e);
                    }
                    res(0);
                }
            });
        });
    };


    console.log(' ');
    console.log('Try to modify the name of the SampleClass instance by typing "newClass.name = \'new name\'"');
    console.log('or instantiate new objects here via "registerExampleClass(new SampleClass(\'myId\'))" ');
    console.log(' ');

    // eslint-disable-next-line no-constant-condition
    while (true) {
        await sendNumber();
    }
})();
