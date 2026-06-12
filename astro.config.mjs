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
                      { label: 'MONAI — Architecture', slug: 'oss/monai-system-oop-architecture' },
                      { label: 'Codex — System Architecture', slug: 'oss/codex-system-architecture' },
                      { label: 'Pi', slug: 'oss/pi-mono-oop-uml-architecture' },
                      { label: 'Warp — System Architecture (C4)', slug: 'oss/warp-system-architecture' },
                      { label: 'Warp — Desktop App Build', slug: 'oss/warp-desktop-app' },
                      { label: 'Unsloth Studio — Architecture (C4 + UML)', slug: 'oss/unsloth-studio-architecture' },
                      { label: 'DeepAgents — Architecture', slug: 'oss/deepagents-architect-oop' },
                      { label: 'Evidently — Architecture', slug: 'oss/evidently-system-oop-architecture' },
                      { label: 'Segmentation Models PyTorch — Architecture', slug: 'oss/smp-architecture-oop' },
                      { label: 'MarkItDown — Architecture', slug: 'oss/markitdown-architecture-oop' },
                      { label: 'FLIP — Architecture', slug: 'oss/flip-architecture-oop' },
                      { label: 'FLIP — OMOP DB', slug: 'oss/flip-omop-db-architecture' },
                      { label: 'ClickClack — Architecture', slug: 'oss/clickclack-architecture'}
                  ],
              },
              {
                  label: 'OSS Package Example',
                  collapsed: false,
                  items: [
                      { label: "fs (R-Pkg)", slug: 'pkg/fs-rpkg-architecture'},
                      { label: "TorchIO", slug: 'pkg/torchio_architecture'},
                      { label: "fo-dicom", slug: 'pkg/fodicom-architecture'},
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
                  label: 'Communication',
                  collapsed: false,
                  items: [
                      { label: 'Communication Patterns', slug: 'communication/communication-patterns' },
                      { label: 'Cross-Language Communication', slug: 'communication/cross-language-communication' },
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
                label: "Agents System",
                collapsed: false,
                items: [
                    { label: 'Agent Script', slug: 'agentic/agent-scripts-system-architecture' },
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
