// https://app.unpkg.com/@ffmpeg/core@0.12.10/files/dist/umd
//  - ffmpeg-core.js
//  - ffmpeg-core.wasm
// https://app.unpkg.com/@ffmpeg/ffmpeg@0.12.15/files/dist/umd
//  - 814.ffmpeg.js
//  - ffmpeg.js
// https://app.unpkg.com/@ffmpeg/core-mt@0.12.10/files/dist/umd
// - ffmpeg-core.js
// - ffmpeg-core.wasm
// - ffmpeg-core.worker.js
// vendor/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js
// no leading slash
const paths = {
    ffmpegJS: 'dist/umd/ffmpeg.js',
    wasmJS: 'dist/umd/814.ffmpeg.js',
    coreJS: 'dist/umd/ffmpeg-core.js',
    coreWASM: `dist/umd/ffmpeg-core.wasm`,
    coreMtJS: `dist/umd/ffmpeg-core.js`,
    coreMtWASM: `dist/umd/ffmpeg-core.wasm`,
    coreMTWorker: `dist/umd/ffmpeg-core.worker.js`
}

const remoteBase=  "https://unpkg.com";

export async function ffmpegURLs(coreVersion="0.12.10",
                                 ffmpegVersion="0.12.15",
                                 localPath=null
) {

    const path = typeof localPath === "string" ? localPath : remoteBase;

    return  {
        ffmpegJS: `${path}/@ffmpeg/ffmpeg@${ffmpegVersion}/${paths.ffmpegJS}`,
        wasmJS: `${path}/@ffmpeg/ffmpeg@${ffmpegVersion}/${paths.wasmJS}`,
        coreJS: `${path}/@ffmpeg/core@${coreVersion}/${paths.coreJS}`,
        coreWASM: `${path}/@ffmpeg/core@${coreVersion}/${paths.coreWASM}`,
        coreMtJS: `${path}/@ffmpeg/core-mt@${coreVersion}/${paths.coreMtJS}`,
        coreMtWASM: `${path}/@ffmpeg/core-mt@${coreVersion}/${paths.coreMtWASM}`,
        coreMTWorker: `${path}/@ffmpeg/core-mt@${coreVersion}/${paths.coreMTWorker}`,
    };

}
