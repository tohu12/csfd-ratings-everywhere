import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://tohu12.github.io/csfd-ratings-everywhere/',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://www.csfd.cz/*'],
    action: { default_title: '__MSG_extName__' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'csfd-ratings-everywhere@tohu12.github.io',
          // 140 (ESR) is the first desktop release with data_collection_permissions.
          strict_min_version: '140.0',
          // Film ids found on visited pages are sent to csfd.cz (SPEC §4) → declared honestly.
          data_collection_permissions: { required: ['websiteContent'] },
        },
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  }),
});
