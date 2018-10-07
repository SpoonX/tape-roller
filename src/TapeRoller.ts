import * as fs from 'fs';
import { resolve, join } from 'path';
import { promisify } from 'util';
import streamReplace from 'stream-replace';
import { Homefront } from 'homefront';
import { exec, spawn } from 'child_process';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import glob from 'glob';
import hasYarn from 'has-yarn';

export type ConfigType = Partial<{
  sourceDirectory: string,
  targetDirectory: string,
  sourceFile: string,
  targetFile: string,
}>;

export type ModifyType = Partial<{
  append: string,
  prepend: string,
  replace: string,
  custom: Function,
}>;

export type StreamType = fs.ReadStream | fs.WriteStream;

export class TapeRoller {
  private readonly sourceDirectory?: string;

  private readonly targetDirectory?: string;

  private sourceFile?: string;

  private targetFile?: string;

  private stream?: StreamType;

  constructor ({ sourceDirectory, targetDirectory, sourceFile, targetFile }: ConfigType = {}) {
    this.sourceDirectory = sourceDirectory;
    this.targetDirectory = targetDirectory;
    this.sourceFile      = sourceFile;
    this.targetFile      = targetFile;
  }

  private static resolvePath (dir?: string, file?: string): string {
    return resolve(process.cwd(), dir || '', file || '');
  }

  public static async fromGlob (pattern: string, options?: { [key: string]: any }, targetDirectory?: string): Promise<TapeRoller[]> {
    const asyncGlob = promisify(glob);
    const files     = await asyncGlob(pattern, options);

    return files.map((sourceFile: string) => new TapeRoller({ targetDirectory, sourceFile }));
  }

  public static async addDep (dependency: string, dev?: boolean, cwd?: string): Promise<void> {
    const yarn = hasYarn();
    let command = yarn
      ? `yarn add ${dependency}`
      : `npm install ${dependency} ${!dev ? '--save' : ''}`;

    if (cwd) {
      command += yarn ? ` --cwd ${cwd}` : ` --cwd ${cwd} --prefix ${cwd}`;
    }

    if (dev) {
      command += ' -D';
    }

    const process = exec(command);

    process.on('error', (error) => {
      throw new Error(error.message);
    });

    process.on('close', (status: number) => {
      if (status !== 0) {
        throw new Error(`Adding dependency failed (${status}).\nGot error: ${process.stderr}`);
      }

      console.log(`Added dependency: ${dependency}`);
    });
  }

  public async rename (oldPath: string, newPath: string): Promise<this> {
    await promisify(fs.rename)(oldPath, newPath);

    return this;
  }

  public read (file?: string): this {
    if (file) {
      this.sourceFile = file;
    }

    if (!this.sourceFile) {
      throw new Error('No source file provided');
    }

    const path = TapeRoller.resolvePath(this.sourceDirectory, this.sourceFile);

    this.stream = fs.createReadStream(path);

    this.stream.on('error', (error) => {
      throw new Error(error.message);
    });

    return this;
  }

  public async write (file?: string, temp?: boolean): Promise<this> {
    if (file) {
      this.targetFile = file;
    }

    const fileName = temp ? `__temp__${this.targetFile}` : this.targetFile;
    const path     = TapeRoller.resolvePath(this.targetDirectory);
    const fullPath = join(path, fileName);

    if (this.targetDirectory) {
      await promisify(mkdirp)(this.targetDirectory);
    }

    this.stream = this.stream.pipe(fs.createWriteStream(fullPath));

    if (temp) {
      this.stream.on('close', async () => {
        await this.rename(fullPath, join(path, this.targetFile));
      });
    }

    return this;
  }

  public async copy (source?: string, target?: string): Promise<this> {
    if (source) {
      this.sourceFile = source;
    }

    if (target) {
      this.targetFile = target;
    }

    if (!this.stream) {
      this.read();
    }

    await this.write();

    return this;
  }

  public replace (parameters: { [key: string]: any }) {
    if (!this.stream) {
      throw new Error('No read stream found. Did you forget to call ".read()"?');
    }

    const params  = new Homefront(parameters);
    const regex   = /{{\s?([\w.]+)(?:(?:\s?:\s?)(?:(?:['"]?)(.*?)(?:['"]?)))?\s?}}/gi;
    const replace = (match: string, parameter: string, defaultValue: string): string => {
      return params.fetch(parameter) || defaultValue || match;
    };

    this.stream = this.stream.pipe(this.applyModify(regex, { custom: replace }));

    return this;
  }

  public modify (pattern: RegExp, { append, prepend, custom, replace }: ModifyType): this {
    if (!this.stream) {
      this.read();
    }

    this.stream = this.stream.pipe(this.applyModify(pattern, { append, prepend, custom, replace }));

    return this;
  }

  private applyModify (pattern: RegExp, { append, prepend, custom, replace }: ModifyType): fs.WriteStream {
    return streamReplace(pattern, (match: string, parameter: string, defaultValue: string): string => {
      if (typeof replace !== 'undefined') {
        return replace;
      }

      if (typeof append !== 'undefined') {
        return match + append;
      }

      if (typeof prepend !== 'undefined') {
        return prepend + match;
      }

      if (typeof custom === 'function') {
        return custom(match, parameter, defaultValue);
      }

      return match;
    });
  }

  public clone (repository: string, projectName?: string, cwd: string = null) {
    const args = ['clone', repository];

    if (projectName) {
      args.push(projectName);
    }

    const process = spawn('git', args, { cwd });
    const name    = projectName || repository.match(/\/([\w-_]+)\.git$/)[1];
    const path    = cwd ? join(cwd, name) : name;

    process.on('close', (status: number) => {
      if (status !== 0) {
        return;
      }

      this.remove(join(path, '.git'), true);
      this.installDependencies(path);
    });

    process.on('error', (error) => {
      throw new Error(error.message);
    });

    return this;
  }

  private installDependencies (path: string): this {
    const command = hasYarn() ? `yarn --cwd ${path} install` : `npm i --cwd ${path} --prefix ${path}`;
    const process = exec(command);

    process.on('close', (status: number) => {
      if (status !== 0) {
        return;
      }

      console.log('Installed dependencies');
    });

    process.on('error', (error) => {
      throw new Error(error.message);
    });

    return this;
  }

  private removeFile (path: string): this {
    const errorCodes: string[] = ['EPERM', 'EISDIR'];

    fs.unlink(path, (error) => {
      if (error) {
        if (errorCodes.includes(error.code)) {
          throw new Error('Cannot remove directory if recursive is false');
        }

        throw new Error(error.message);
      }

      return console.log('Removed file ' + path);
    });

    return this;
  }

  private removeDir (path: string): this {
    rimraf(path, (error) => {
      if (error) {
        throw new Error(error.message);
      }
    });

    return this;
  }

  public remove (path: string, recursive: boolean = false): this {
    const resolvedPath = TapeRoller.resolvePath(path);

    if (!recursive) {
      return this.removeFile(resolvedPath);
    }

    return this.removeDir(resolvedPath);
  }
}
