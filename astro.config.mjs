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
                      { label: 'Pi', slug: 'oss/pi-mono-oop-uml-architecture' },
                      { label: 'Warp — System Architecture (C4)', slug: 'oss/warp-system-architecture' },
                      { label: 'Warp — Desktop App Build', slug: 'oss/warp-desktop-app' },
                      { label: 'Unsloth Studio — Architecture (C4 + UML)', slug: 'oss/unsloth-studio-architecture' }
                  ],
              },
              {
                  label: 'Architecture Patterns',
                  collapsed: false,
                  items: [
                      { label: "Software Architecture (High level)", slug: 'arch-patterns/software-archietecture-highlv'}, 
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
                  label: 'Software Design',
                  collapsed: false,
                  items: [
                      { label: 'C4 Architecture Approach', slug: 'design/c4-architecture-approach-explained' },
                  ],
              },
              {
                label: "Automation",
                collapsed: false,
                items: [
                    { label: 'Autoresearch (Karpathy)', slug: 'automation/autoresearch-karpathy' },
                ]
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