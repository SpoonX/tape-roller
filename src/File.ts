import createDebug from 'debug';
import * as fs from 'fs';
import { mkdir } from 'fs';
import * as util from 'util';
import { Manipulator } from './Manipulator';
import rimraf from 'rimraf';
import { promisify } from 'util';
import isGlob from 'is-glob';
import glob, { IOptions } from 'glob';
import { ModifyType } from './types';

const debug = createDebug('tape-roller:File');

export class File {
  public static async generate (source: string, destination: string, parameters: { [key: string]: any } = {}, options?: IOptions): Promise<void> {
    const file = await this.getFileTask(source, options);

    await file.replace(parameters).write(destination);
  }

  public static async modify (fileName: string, pattern: RegExp, modifier: ModifyType, options?: IOptions): Promise<void>{
    const file = await this.getFileTask(fileName, options);

    await file.modify(pattern, modifier).update();
  }

  public static async getFileTask (source: string, options?: IOptions): Promise<Manipulator> {
    const asGlob = isGlob(source);

    debug(`Starting FileManager.generate as ${asGlob ? 'glob' : 'file'}.`);

    return asGlob ? await File.readGlob(source, options) : File.read(source);
  }

  public static async move (from: string, to: string): Promise<void> {
    await util.promisify(fs.rename)(from, to);
  }

  public static read (file: string | string[], concatFileName: boolean = false, options?: IOptions): Manipulator {
    return new Manipulator(file, concatFileName, options);
  }

  public static async readGlob (pattern: string, options?: IOptions): Promise<Manipulator> {
    return File.read(await promisify(glob)(pattern, { nodir: true, ...options }), true, options);
  }

  public static async mkdir (path: string, recursive: boolean = true): Promise<void> {
    return await util.promisify(mkdir)(path, { recursive });
  }

  public static async copy (source: string, destination: string): Promise<void> {
    await File.read(source).write(destination);
  }

  public static async remove (path: string, recursive = false): Promise<void> {
    if (recursive) {
      return await util.promisify(rimraf)(path);
    }

    await util.promisify(fs.unlink)(path);
  }
}
