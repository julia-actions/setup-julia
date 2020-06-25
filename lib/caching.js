"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cache = __importStar(require("@actions/cache"));
const glob = __importStar(require("@actions/glob"));
const path = __importStar(require("path"));
// TODO: Change to hashFiles once https://github.com/actions/toolkit/issues/472 has been resolved
const md5File = __importStar(require("md5-file"));
const JULIA_HOME = path.join(`${process.env.HOME}`, '.julia');
/**
 * Cache the ~/.julia/artifacts directory.
 */
function cacheArtifacts() {
    return __awaiter(this, void 0, void 0, function* () {
        const projectFiles = yield (yield glob.create('**/Project.toml')).glob();
        let projectsHash = '';
        projectFiles.forEach((f) => {
            projectsHash.concat('-', md5File.sync(f));
        });
        const paths = [path.join(JULIA_HOME, 'artifacts')];
        const key = `artifacts-${process.env.RUNNER_OS}-${projectsHash}`;
        return cache.saveCache(paths, key);
    });
}
exports.cacheArtifacts = cacheArtifacts;
