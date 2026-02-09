import path from "node:path";

import { MakerBase, MakerOptions } from "@electron-forge/maker-base";
import { ForgePlatform } from "@electron-forge/shared-types";
import fs from "fs-extra";

export type MakerPortableConfig = Record<string, never>;

/**
 * Copies the packaged app to out/make/portable/<arch>/ so you get a runnable
 * folder: run the .exe from that folder. No installer, no NSIS.
 */
export default class MakerPortable extends MakerBase<MakerPortableConfig> {
  name = "portable";

  defaultPlatforms: ForgePlatform[] = ["win32"];

  isSupportedOnCurrentPlatform(): boolean {
    return process.platform === "win32";
  }

  async make({
    dir,
    makeDir,
    targetArch,
    packageJSON,
    appName,
    forgeConfig,
  }: MakerOptions): Promise<string[]> {
    const exeName =
      (forgeConfig.packagerConfig?.executableName as string | undefined) ||
      appName;

    const outPath = path.resolve(makeDir, "portable", targetArch);
    await this.ensureDirectory(outPath);
    await fs.copy(dir, outPath, { overwrite: true });

    const exePath = path.join(outPath, `${exeName}.exe`);
    return [exePath];
  }
}
