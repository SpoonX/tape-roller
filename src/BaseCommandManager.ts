import { spawn, SpawnOptions } from 'child_process';

export class BaseCommandManager {
  public static runCommand (command: string, args?: ReadonlyArray<string>, options?: SpawnOptions) {
    const process = spawn(command, args, options);

    return new Promise((resolve, reject) => {
      process.on('error', reject);

      process.on('close', (status: number) => {
        if (status !== 0) {
          return reject(new Error(`Adding dependency failed (${status}).\nGot error: ${process.stderr}`));
        }

        resolve();
      });
    });
  }
}
