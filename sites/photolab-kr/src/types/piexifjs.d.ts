declare module "piexifjs" {
  export type PiexifDict = Record<string, Record<number, unknown>>;
  export const version: string;
  export function remove(jpegBinaryString: string): string;
  export function load(jpegBinaryString: string): PiexifDict;
  export function dump(exifDict: PiexifDict): string;
  export function insert(exifBytes: string, jpegBinaryString: string): string;
  const piexif: {
    version: string;
    remove: typeof remove;
    load: typeof load;
    dump: typeof dump;
    insert: typeof insert;
  };
  export default piexif;
}
