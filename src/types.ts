import * as fs from 'fs';
import { Stream } from "stream";

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

export type TapeRollerConfigType = { templateDirectory: string };

export type SubjectType = { file: string, stream: Stream };
