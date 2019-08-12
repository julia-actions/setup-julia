import * as core from "@actions/core";
import * as exec from "@actions/exec";

import * as os from "os";

async function run() {
  try {
    const version = core.getInput("version");
    core.debug(`selected Julia version: ${version}`);

    // Store information about the environment
    const osPlat = os.platform();
    const osArch = os.arch();

    // For now, just download Linux x64 binaries
    await exec.exec("curl", [
      "-O",
      "https://julialang-s3.julialang.org/bin/linux/x64/1.0/julia-1.0.1-linux-x86_64.tar.gz"
    ]);
    await exec.exec("tar xf julia-1.0.1-linux-x86_64.tar.gz");

    // Add the downloaded binary to path
    core.addPath("julia-1.0.1/bin");

    // Test if it worked
    await exec.exec("julia", ["--version"]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
