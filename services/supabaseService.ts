import { createClient } from '@supabase/supabase-js';
import { Character, GeneratedImage, GeneratedVideo } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL veya Key bulunamadı! localStorage kullanılacak.');
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Karakter işlemleri
export const supabaseService = {
  // Karakterleri getir
  async getCharacters(): Promise<Character[]> {
    if (!supabase) {
      console.warn('Supabase bağlantısı yok, localStorage kullanılıyor');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((char: any) => ({
        id: char.id,
        name: char.name,
        images: char.images || [],
        createdAt: new Date(char.created_at).getTime()
      }));
    } catch (error) {
      console.error('Karakterler getirilemedi:', error);
      return [];
    }
  },

  // Yeni karakter oluştur
  async createCharacter(name: string, images: string[]): Promise<Character | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('characters')
        .insert({
          name,
          images,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        images: data.images || [],
        createdAt: new Date(data.created_at).getTime()
      };
    } catch (error) {
      console.error('Karakter oluşturulamadı:', error);
      throw error;
    }
  },

  // Karakter güncelle
  async updateCharacter(id: string, updates: { name?: string; images?: string[] }): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('characters')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Karakter güncellenemedi:', error);
      throw error;
    }
  },

  // Karakter sil
  async deleteCharacter(id: string): Promise<void> {
    if (!supabase) return;

    try {
      // Önce karaktere ait görselleri ve videoları sil
      await supabase.from('generated_images').delete().eq('character_id', id);
      await supabase.from('generated_videos').delete().eq('character_id', id);

      // Sonra karakteri sil
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Karakter silinemedi:', error);
      throw error;
    }
  },

  // Görsel kaydet
  async saveImage(image: GeneratedImage, isArchived: boolean = false): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('generated_images')
        .insert({
          id: image.id,
          character_id: image.characterId,
          url: image.url,
          name: image.name,
          prompt: image.prompt,
          timestamp: image.timestamp,
          is_archived: isArchived
        });

      if (error) throw error;
    } catch (error) {
      console.error('Görsel kaydedilemedi:', error);
      throw error;
    }
  },

  // Görselleri getir
  async getImages(characterId?: string, archived: boolean = false): Promise<GeneratedImage[]> {
    if (!supabase) return [];

    try {
      let query = supabase
        .from('generated_images')
        .select('*')
        .eq('is_archived', archived)
        .order('timestamp', { ascending: false });

      if (characterId) {
        query = query.eq('character_id', characterId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((img: any) => ({
        id: img.id,
        url: img.url,
        name: img.name,
        prompt: img.prompt,
        timestamp: img.timestamp,
        characterId: img.character_id
      }));
    } catch (error) {
      console.error('Görseller getirilemedi:', error);
      return [];
    }
  },

  // Görseli arşive gönder
  async archiveImage(imageId: string): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('generated_images')
        .update({ is_archived: true })
        .eq('id', imageId);

      if (error) throw error;
    } catch (error) {
      console.error('Görsel arşivlenemedi:', error);
      throw error;
    }
  },

  // Görseli arşivden çıkar
  async unarchiveImage(imageId: string): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('generated_images')
        .update({ is_archived: false })
        .eq('id', imageId);

      if (error) throw error;
    } catch (error) {
      console.error('Görsel arşivden çıkarılamadı:', error);
      throw error;
    }
  },

  // Görsel sil
  async deleteImage(imageId: string): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('generated_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
    } catch (error) {
      console.error('Görsel silinemedi:', error);
      throw error;
    }
  },

  // Video kaydet
  async saveVideo(video: GeneratedVideo, isArchived: boolean = false): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('generated_videos')
        .insert({
          id: video.id,
          character_id: video.characterId,
          url: video.url,
          name: video.name,
          prompt: video.prompt,
          timestamp: video.timestamp,
          is_archived: isArchived
        });

      if (error) throw error;
    } catch (error) {
      console.error('Video kaydedilemedi:', error);
      throw error;
    }
  },

  // Videoları getir
  async getVideos(characterId?: string, archived: boolean = false): Promise<GeneratedVideo[]> {
    if (!supabase) return [];

    try {
      let query = supabase
        .from('generated_videos')
        .select('*')
        .eq('is_archived', archived)
        .order('timestamp', { ascending: false });

      if (characterId) {
        query = query.eq('character_id', characterId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((vid: any) => ({
        id: vid.id,
        url: vid.url,
        name: vid.name,
        prompt: vid.prompt,
        timestamp: vid.timestamp,
        characterId: vid.character_id
      }));
    } catch (error) {
      console.error('Videolar getirilemedi:', error);
      return [];
    }
  },

  // Videoyu arşive gönder
  async archiveVideo(videoId: string): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('generated_videos')
        .update({ is_archived: true })
        .eq('id', videoId);

      if (error) throw error;
    } catch (error) {
      console.error('Video arşivlenemedi:', error);
      throw error;
    }
  },

  // Videoyu arşivden çıkar
  async unarchiveVideo(videoId: string): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('generated_videos')
        .update({ is_archived: false })
        .eq('id', videoId);

      if (error) throw error;
    } catch (error) {
      console.error('Video arşivden çıkarılamadı:', error);
      throw error;
    }
  },

  // Video sil
  async deleteVideo(videoId: string): Promise<void> {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('generated_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;
    } catch (error) {
      console.error('Video silinemedi:', error);
      throw error;
    }
  }
};
