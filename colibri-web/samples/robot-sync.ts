import { Colibri, RegisterModelSync, SyncModel, Synced, ModelSyncRegistration } from '@hcikn/colibri';
import { rl, colibriAddress } from './common';
import { Observable } from 'rxjs';
import { forEach } from 'lodash';


/**
 *  To use the @Synced() decorator, please add the following to the "compiler" field of your tsconfig.json:
 *  "experimentalDecorators": true
 */
export class SyncPath extends SyncModel<SyncPath> {
    @Synced()
    public position = [0, 0, 0];

    /* Warning: for some reason syncing fields does not work with some frameworks (e.g., React)! */
    @Synced()
    public rotation = [0, 0, 0, 0];

    // We can provide a custom name for the synced property
    @Synced()
    public owner = '';

    @Synced()
    public path = [];
}

export class SyncRobot extends SyncModel<SyncRobot> {
    @Synced()
    public position = [0, 0, 0];

    /* Warning: for some reason syncing fields does not work with some frameworks (e.g., React)! */
    @Synced()
    public rotation = [0, 0, 0, 0];

    // We can provide a custom name for the synced property
    @Synced()
    public robot_id = '';
}

class SyncManagerRobot {

    public sampleClasses$: Observable<SyncRobot[]> | undefined;

    public registerNewObject: ((model: SyncRobot) => void) = (model: SyncRobot) => {};

    public getObjectInstance: ((id: string) => SyncRobot | undefined) = (id: string) => { return undefined; };

    private model_id: string = '';

    constructor(model_id: string) {
        this.model_id = model_id;
    }

    registerManager() {
        /**
         *  This is the registration for the SampleClass.
         *  It returns an observable (BehaviorSubject) that contains all instances of SampleClass and a function to register new instances.
         */
        const [ SampleClasses$, registerExampleClass ] = RegisterModelSync<SyncRobot>({ type: SyncRobot, model_id: this.model_id });

        this.registerNewObject = registerExampleClass;
        //this.getObjectInstance = getClassInstance;

        this.sampleClasses$ = SampleClasses$;
        // SampleClasses$ contains all synchronized instances.
        // Since 'RegisterModelSync' returns a BehaviorSubject, the method will be executed with the current value.
        this.sampleClasses$.subscribe(classes => {
            // will be called whenever a new instance is created, an existing one is updated, or one is deleted
            // please refer to RxJS documentation for more information: https://rxjs.dev/guide/overview
            console.log('<----- log changes');
            classes.forEach(c => {
                console.log(c.id, c.position, c.rotation, c.robot_id);
            });
            console.log('log changes ----->');
        });
    }

}



(async () => {
    Colibri.init('TelloUnity', "localhost", 9011);

    /**
     *  This is the registration for the SampleClass.
     *  It returns an observable (BehaviorSubject) that contains all instances of SampleClass and a function to register new instances.
     */
    //var managerPath = new SyncManager<SyncPath>({ type: SyncPath, model_id: 'paths_vr' });
    //managerPath.registerManager();

    var managerRobots = new SyncManagerRobot('robot_vr');
    managerRobots.registerManager();



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
