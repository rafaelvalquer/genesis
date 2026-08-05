export function installNonPassiveContextMenuGuard(
  target,
) {
  if (!target?.addEventListener) {
    return () => {};
  }

  const preventNativeContextMenu = (event) => {
    event.preventDefault();
  };

  const options = {
    passive: false,
  };

  target.addEventListener(
    "contextmenu",
    preventNativeContextMenu,
    options,
  );

  return () => {
    target.removeEventListener(
      "contextmenu",
      preventNativeContextMenu,
      options,
    );
  };
}
