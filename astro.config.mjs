// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  integrations: [
      starlight({
          title: 'Software Design Explore',
          social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
          sidebar: [
              {
                  label: 'OSS Examples',
                  collapsed: false,
                  items: [
                      { label: 'MONAI Deploy Informatics Gateway', slug: 'oss/monai-deploy-info-gw-system' },
                  ],
              },
              {
                  label: 'Architecture Patterns',
                  collapsed: false,
                  items: [
                      { label: 'Plugin Architecture: MONAI Deploy Info GW', slug: 'arch-patterns/monai-deploy-plugin-arch' },
                  ],
              },
              {
                  label: 'Reference',
                  collapsed: false,
                  autogenerate: { directory: 'reference' },
              },
          ],
      }),
      mermaid({
          theme: 'forest',
          autoTheme: true
      })
	],

  adapter: netlify(),
});