// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
  integrations: [
      starlight({
          title: 'Software Design Explore',
          social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Lightbridge-KS/software-design-explore' }],
          sidebar: [
              {
                  label: 'OSS Examples',
                  collapsed: false,
                  items: [
                      { label: 'MONAI Deploy Informatics Gateway', slug: 'oss/monai-deploy-info-gw-system' },
                      { label: 'Pi', slug: 'oss/pi-mono-oop-uml-architecture' }
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
                  label: '.NET Clean Architecture',
                  collapsed: false,
                  items: [
                      { label: 'Clean Architecture System Design (Jason)', slug: 'clean-arch/cleanarchitecture-oop-systemdesign-jason' },
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
});