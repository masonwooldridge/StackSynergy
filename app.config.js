// The repository root is the Vite/backend project. Native configuration lives in mobile/.
export default () => {
  throw new Error(
    "StackSynergy's Expo app lives in mobile/. From the repository root run npm run dev:all " +
    "(web + API + Expo for your phone), or npm run expo (Expo only, backend required). " +
    "For Expo diagnostics/export, cd mobile first. Do not run npx expo start here."
  );
};
