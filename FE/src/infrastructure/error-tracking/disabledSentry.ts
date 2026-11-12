// Resolved only by the build when error reporting is disabled.
const disabled = () => {};
export {
  disabled as init,
  disabled as setTag,
  disabled as setUser,
  disabled as addBreadcrumb,
  disabled as withScope,
  disabled as captureException,
};
