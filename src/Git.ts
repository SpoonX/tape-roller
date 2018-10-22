import { BaseCommandManager } from './BaseCommandManager';
import createDebug from 'debug';

const debug = createDebug('tape-roller:Git');

export class Git extends BaseCommandManager {
  public static async run (cwd: string, ...args: string[]): Promise<void> {
    await this.runCommand('git', args, { cwd });
  }

  public static async clone (remote: string, projectName: string = '', cwd: string = null) {
    debug(`Cloning ${remote} into ${projectName}`);

    await this.run(cwd, 'clone', remote, projectName);

    debug(`Finishing cloning.`);
  }
}
