/* Concrete Flow – Bootloader: lädt Three.js als Modul + Addons und danach die Spielskripte */
import * as THREE_NS from 'three';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from './jsm/postprocessing/SSAOPass.js';
import { Sky } from './jsm/objects/Sky.js';
import { FXAAShader } from './jsm/shaders/FXAAShader.js';
import { GammaCorrectionShader } from './jsm/shaders/GammaCorrectionShader.js';
import { ACESFilmicToneMappingShader } from './jsm/shaders/ACESFilmicToneMappingShader.js';
import { mergeBufferGeometries } from './jsm/utils/BufferGeometryUtils.js';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from './jsm/utils/SkeletonUtils.js';

window.THREE = Object.assign({}, THREE_NS);
window.THREEX = { GLTFLoader, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, SSAOPass, Sky, FXAAShader, GammaCorrectionShader, ACESFilmicToneMappingShader, mergeBufferGeometries, FBXLoader, SkeletonUtils };

const files = ['audio', 'input', 'world', 'env', 'skater', 'player', 'npc', 'progress', 'replay', 'photo', 'admin', 'props', 'editor', 'game'];
for (const f of files) {
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `js/${f}.js`; s.onload = resolve;
    s.onerror = () => reject(new Error('Konnte js/' + f + '.js nicht laden'));
    document.body.appendChild(s);
  });
}
