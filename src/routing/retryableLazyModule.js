export function createRetryableLazyModule(importer) {
  if (typeof importer !== "function") {
    throw new TypeError(
      "createRetryableLazyModule exige uma função de importação.",
    );
  }

  let pendingModule = null;

  const load = () => {
    if (!pendingModule) {
      pendingModule = Promise.resolve()
        .then(() => importer())
        .catch((error) => {
          pendingModule = null;
          throw error;
        });
    }

    return pendingModule;
  };

  load.preload = load;

  load.reset = () => {
    pendingModule = null;
  };

  return load;
}
