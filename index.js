const path = require("path");
const resolve = require("resolve");

const isRelativePath = (nodePath) => {
  return nodePath.match(/^\.?\.\//);
};

const toLocalPath = (modulePath) => {
  if (!isRelativePath(modulePath)) {
    modulePath = `./${modulePath}`; // insert `./` to make it a relative path
  }
  return modulePath;
};

const nodeResolvePath = (modulePath, basedir, extensions) => {
  try {
    return resolve.sync(modulePath, { basedir, extensions });
  } catch (e) {
    return null;
  }
};

const resolveModuleFromCandidates = (modulePath, candidates, extensions) => {
  for (const candidate of candidates) {
    const resolvedPath = nodeResolvePath(modulePath, candidate, extensions);

    if (resolvedPath) return resolvedPath;
  }
  return null;
};

const resolveModuleInHighestLayer = (
  absoluteLayerPaths,
  moduleWithinLayerPath
) => {
  return resolveModuleFromCandidates(moduleWithinLayerPath, absoluteLayerPaths);
};

const resolveModuleInLowestLayer = (
  absoluteLayerPaths,
  moduleWithinLayerPath
) => {
  return resolveModuleFromCandidates(
    moduleWithinLayerPath,
    absoluteLayerPaths.slice().reverse()
  );
};

const getLayerInfo = (absoluteLayerPaths, absoluteModulePath) => {
  const absoluteLayerPath = absoluteLayerPaths.find(
    (absoluteLayerPath) => absoluteModulePath.indexOf(absoluteLayerPath) === 0
  );

  if (!absoluteLayerPath) return null;

  const modulePath = toLocalPath(
    path.relative(absoluteLayerPath, absoluteModulePath)
  );

  return {
    absoluteLayerPath,
    modulePath,
  };
};

const transformSource = (nodePath, state) => {
  const src = nodePath.get("source");

  if (!state.types.isStringLiteral(src)) {
    return;
  }

  const importFile = src.node.value;

  // Ignore non-relative paths
  // at this point (after babel-plugin-module-resolver) absolute paths can only point to node_modules or similar
  if (!isRelativePath(importFile)) return;

  const currentFile = state.file.opts.filename;
  const currentDir = path.dirname(currentFile);
  const rootDir = state.opts.root;
  const extensions = state.opts.extensions;

  const absoluteImportFile = resolveModuleFromCandidates(
    importFile,
    [currentDir, rootDir],
    extensions
  );

  if (!absoluteImportFile) {
    console.warn(
      `Could not resolve imported module "${importFile} from ${currentDir} or ${rootDir}"`
    );
    return;
  }

  const shadowingContext = getOrCreateShadowingContext(state);

  // Identify from which layer module is imported
  const importModuleLayerInfo = getLayerInfo(
    shadowingContext.absoluteLayerPaths,
    absoluteImportFile
  );

  // If module is not part of a layer then it is not shadowable
  if (!importModuleLayerInfo) return;

  const currentModuleLayerInfo = getLayerInfo(
    shadowingContext.absoluteLayerPaths,
    currentFile
  );

  // If module imports itself, then resolve to lowest / base layer
  let absoluteShadowingModulePath;
  if (
    currentModuleLayerInfo &&
    currentModuleLayerInfo.modulePath === importModuleLayerInfo.modulePath
  ) {
    absoluteShadowingModulePath = resolveModuleInLowestLayer(
      shadowingContext.absoluteLayerPaths,
      importModuleLayerInfo.modulePath
    );
  } else {
    // Otherwise resolve module to highest layer
    absoluteShadowingModulePath = resolveModuleInHighestLayer(
      shadowingContext.absoluteLayerPaths,
      importModuleLayerInfo.modulePath
    );
  }

  // TODO: This probably shouldn't happen at this point?
  if (!absoluteShadowingModulePath) return;

  // Rewrite import
  const relativeShadowingModulePath = toLocalPath(
    path.relative(currentDir, absoluteShadowingModulePath)
  );

  src.replaceWith(state.types.stringLiteral(relativeShadowingModulePath));
};

const getOrCreateShadowingContext = (state) => {
  if (state.shadowingContext) return state.shadowingContext;

  const opts = state.opts;

  const root = opts.root;
  const layerRoot = opts.layerRoot || "./";
  const layers = opts.layers || [];

  const absoluteRootPath = path.resolve(root);
  const absoluteLayerRoot = path.resolve(absoluteRootPath, layerRoot);
  const absoluteLayerPaths = layers.map((layer) =>
    path.resolve(absoluteLayerRoot, layer)
  );

  state.shadowingContext = {
    root,
    layerRoot,
    layers,
    absoluteRootPath,
    absoluteLayerRoot,
    absoluteLayerPaths,
  };

  return state.shadowingContext;
};

module.exports = ({ types }) => ({
  name: "file-shadowing",
  pre(file) {
    this.types = types;
  },
  visitor: {
    "ImportDeclaration|ExportDeclaration": transformSource,
  },
});
