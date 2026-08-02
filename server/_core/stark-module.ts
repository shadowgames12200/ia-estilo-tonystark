/**
 * Stark & Alexa Module - Automação e Voz
 * Este módulo permite que a IA controle dispositivos IoT e processe comandos de voz.
 */

import axios from "axios";
import { ENV } from "./env.js";

// --- Tipos para Automação ---
export type IoTDevice = {
  id: string;
  name: string;
  type: "light" | "ac" | "lock" | "tv";
  status: "on" | "off";
};

// --- Módulo de Voz (Voz do J.A.R.V.I.S.) ---
export const VoiceService = {
  /**
   * Converte texto em fala usando ElevenLabs (Voz sofisticada)
   */
  async textToSpeech(text: string): Promise<string | null> {
    if (!ENV.ELEVENLABS_API_KEY || !ENV.ELEVENLABS_VOICE_ID) {
      console.log("[Stark-Voice] ElevenLabs não configurado. Usando fallback do browser.");
      return null;
    }

    try {
      console.log(`[Stark-Voice] Gerando voz via ElevenLabs para: ${text.slice(0, 30)}...`);
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${ENV.ELEVENLABS_VOICE_ID}`,
        {
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            "xi-api-key": ENV.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
        }
      );

      // Aqui você salvaria o buffer em um storage e retornaria a URL
      // Por simplicidade neste scaffold, retornamos o buffer ou um log
      return "audio_data_generated";
    } catch (error) {
      console.error("[Stark-Voice] Erro ElevenLabs:", (error as Error).message);
      return null;
    }
  }
};

// --- Módulo de Automação (Jeito Stark) ---
export const HomeAutomation = {
  /**
   * Controla dispositivos via Home Assistant
   */
  async controlDevice(deviceName: string, action: "on" | "off"): Promise<string> {
    console.log(`[Stark-Home] Executando: ${action} em ${deviceName}`);
    
    if (!ENV.HOME_ASSISTANT_URL || !ENV.HOME_ASSISTANT_TOKEN) {
      return `Simulação: O(A) ${deviceName} foi ${action === 'on' ? 'ligado(a)' : 'desligado(a)'}, Senhor. (Configure o Home Assistant para ação real)`;
    }

    try {
      await axios.post(
        `${ENV.HOME_ASSISTANT_URL}/api/services/homeassistant/turn_${action}`,
        { entity_id: deviceName.includes(".") ? deviceName : `switch.${deviceName}` },
        {
          headers: {
            Authorization: `Bearer ${ENV.HOME_ASSISTANT_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      return `Entendido, senhor. O sistema confirmou que o(a) ${deviceName} está agora ${action === 'on' ? 'ativo(a)' : 'inativo(a)'}.`;
    } catch (error) {
      console.error("[Stark-Home] Erro Home Assistant:", (error as Error).message);
      return `Houve uma falha na comunicação com os sistemas da casa, Senhor. Erro: ${(error as Error).message}`;
    }
  },

  /**
   * Status Geral da Casa
   */
  async getHomeStatus(): Promise<string> {
    if (!ENV.HOME_ASSISTANT_URL || !ENV.HOME_ASSISTANT_TOKEN) {
      return "Todos os sistemas estão operacionais em modo de simulação, Senhor. Luzes da sala apagadas, temperatura em 22 graus.";
    }

    try {
      const response = await axios.get(`${ENV.HOME_ASSISTANT_URL}/api/states`, {
        headers: { Authorization: `Bearer ${ENV.HOME_ASSISTANT_TOKEN}` }
      });
      // Lógica para resumir os estados
      return "Sistemas da casa sincronizados. Tudo parece estar em ordem, Senhor.";
    } catch {
      return "Não consegui obter o status atual da casa, Senhor.";
    }
  }
};

/**
 * Ferramenta Stark para o Agent Loop
 */
export const starkTools = {
  name: "stark_system",
  description: "Controla a casa inteligente (IoT) e fornece status dos sistemas J.A.R.V.I.S.",
  execute: async (args: any) => {
    const { action, device, state } = args;
    switch (action) {
      case "control_home":
        return await HomeAutomation.controlDevice(device, state);
      case "get_status":
        return await HomeAutomation.getHomeStatus();
      default:
        return "Ação não reconhecida pelo protocolo Stark.";
    }
  }
};
