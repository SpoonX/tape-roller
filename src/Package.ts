import hasYarn from 'has-yarn';
import createDebug from 'debug';
import { BaseCommandManager } from './BaseCommandManager';

const debug = createDebug('tape-roller:Package');

export class Package extends BaseCommandManager {
  public static async run (yarn: string, npm: string, ...both: string[]): Promise<void> {
    await this.runCommand(hasYarn ? 'yarn' : 'npm', [ hasYarn ? yarn : npm, ...both ]);
  }

  public static async add (dependency: string, dev: boolean = false): Promise<void> {
    return await this.run('add', 'install', dependency, dev ? '-D' : '');
  }

  public static async install (cwd: string = process.cwd()) {
    debug(`Installing dependencies in "${cwd}".`);

    await this.run('--cwd', 'install --prefix', cwd);

    debug(`Installed dependencies.`);
  }
}
