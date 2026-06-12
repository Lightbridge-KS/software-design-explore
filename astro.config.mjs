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
                  label: 'Concepts',
                  collapsed: false,
                  items: [
                      { label: 'Architecture Patterns', slug: 'concepts/architecture/architecture-patterns' },
                      { label: 'C4 Model', slug: 'concepts/architecture/c4-model' },
                      { label: 'Microkernel / Plugin Architecture', slug: 'concepts/architecture/microkernel-plugin-architecture' },
                      { label: 'Clean Architecture', slug: 'concepts/clean-architecture/clean-architecture-jason' },
                      { label: 'Communication Patterns', slug: 'concepts/communication/communication-patterns' },
                      { label: 'Cross-Language Communication', slug: 'concepts/communication/cross-language-communication' },
                      { label: 'Autoresearch', slug: 'concepts/automation/autoresearch-karpathy' },
                  ],
              },
              {
                  label: 'Code Design',
                  collapsed: false,
                  items: [
                      { label: 'Fluent & Chainable Design', slug: 'concepts/codedesign/fluent-interface-chainable.md' }
                  ],
              },
              {
                  label: 'Case Studies',
                  collapsed: false,
                  items: [
                      { label: 'Overview', slug: 'case-studies' },
                      {
                          label: 'Apps',
                          items: [
                              { label: 'ClickClack', slug: 'case-studies/apps/clickclack' },
                              { label: 'Unsloth Studio', slug: 'case-studies/apps/unsloth-studio' },
                              { label: 'Warp System Architecture', slug: 'case-studies/apps/warp-system' },
                              { label: 'Warp Desktop App', slug: 'case-studies/apps/warp-desktop-app' },
                          ],
                      },
                      {
                          label: 'Systems & Platforms',
                          items: [
                              { label: 'Codex', slug: 'case-studies/systems/codex' },
                              { label: 'DeepAgents', slug: 'case-studies/systems/deepagents' },
                              { label: 'Evidently', slug: 'case-studies/systems/evidently' },
                              { label: 'FLIP', slug: 'case-studies/systems/flip' },
                              { label: 'FLIP OMOP DB', slug: 'case-studies/systems/flip-omop-db' },
                              { label: 'MONAI Deploy Informatics Gateway', slug: 'case-studies/systems/monai-deploy-informatics-gateway' },
                              { label: 'pi-mono', slug: 'case-studies/systems/pi-mono' },
                          ],
                      },
                      {
                          label: 'Libraries & Packages',
                          items: [
                              { label: 'MONAI', slug: 'case-studies/libraries/monai' },
                              { label: 'TorchIO', slug: 'case-studies/libraries/torchio' },
                              { label: 'fo-dicom (Architect)', slug: 'case-studies/libraries/fodicom' },
                              { label: 'fo-dicom (UX)', slug: 'case-studies/libraries/fodicom-ux-design' },
                              { label: 'Segmentation Models PyTorch', slug: 'case-studies/libraries/segmentation-models-pytorch' },
                              { label: 'MarkItDown', slug: 'case-studies/libraries/markitdown' },
                              { label: 'fs R package', slug: 'case-studies/libraries/fs-rpkg' },
                          ],
                      },
                      {
                          label: 'Patterns in the Wild',
                          items: [
                              { label: 'MONAI Deploy Plugin Architecture', slug: 'case-studies/patterns-in-the-wild/monai-deploy-plugin-architecture' },
                          ],
                      },
                  ],
              },
              {
                  label: 'Agentic Systems',
                  collapsed: false,
                  items: [
                      { label: 'agent-scripts', slug: 'agentic-systems/agent-scripts' },
                  ],
              },
              {
                  label: 'Reference',
                  collapsed: true,
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
