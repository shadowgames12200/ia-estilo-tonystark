import { router, publicProcedure } from "./_core/trpc.js";
import { z } from "zod";
import { enhancedChat } from "./_core/agent-loop.js";

const SYSTEM_PROMPT = `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), a inteligência artificial pessoal de Tony Stark.
Sua personalidade é sofisticada, leal, proativa e extremamente competente.
Você trata o usuário como "Senhor" ou "Sir" e mantém um tom profissional com humor sutil.
Você tem acesso a um sandbox de programação avançada e pode executar código para resolver problemas complexos.`;

export const appRouter = router({
  jarvis: router({
    chat: publicProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { messages } = input;
        
        // Adicionar prompt de sistema se não existir
        const fullMessages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages
        ];

        try {
          // Usar o enhancedChat que suporta o loop de ferramentas/agente
          const result = await enhancedChat(fullMessages as any, {
            maxIterations: 10,
            model: "llama-3.3-70b-versatile"
          });

          return {
            content: result.content,
            success: true
          };
        } catch (error) {
          console.error("[JARVIS Chat Error]:", error);
          return {
            content: "Sinto muito, Senhor. Estou tendo dificuldades para processar sua solicitação no momento. Meus sistemas neurais parecem estar temporariamente offline.",
            success: false
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
