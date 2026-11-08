
import { projectsRouter, appProjectsRouter } from '@/modules/projects/server/procedures';
import { createTRPCRouter } from '../init';
import { messagesRouter } from '@/modules/messages/server/procedures';
import { usageRouter } from '@/modules/usage/server/procedures';
import { subscriptionRouter } from '@/modules/subscription/server/procedures';
import { adminRouter } from '@/modules/admin/server/procedures';
import { fragmentsRouter } from '@/modules/fragments/server/procedures';
import { publishRouter } from '@/modules/publish/server/procedures';
import { integrationsRouter } from '@/modules/integrations/server/procedures';
import { buildsRouter } from '@/modules/builds/server/procedures';

export const appRouter = createTRPCRouter({
  usage: usageRouter,
  messages: messagesRouter,
  fragments: fragmentsRouter,
  builds: buildsRouter,
  projects: projectsRouter,
  appProjects: appProjectsRouter, // Exposed separate router for mobile apps
  subscription: subscriptionRouter,
  admin: adminRouter,
  publish: publishRouter,
  integrations: integrationsRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;