import type { ConversationSummary, DirectMessage, PublicProfile } from './cyclingModels';
import { loadPublicProfiles } from './rider';
import { supabase } from './supabase';

type ParticipantRow = { conversation_id: string; user_id: string };

function asMessages(data: unknown): DirectMessage[] {
  return (data ?? []) as DirectMessage[];
}

export async function startDirectConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { other_user_id: otherUserId });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Не удалось открыть диалог.');
  return data;
}

export async function loadConversations(): Promise<ConversationSummary[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];
  const { data: participantData, error: participantError } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id');
  if (participantError) throw participantError;

  const participants = (participantData ?? []) as ParticipantRow[];
  const conversationIds = [...new Set(participants.map((participant) => participant.conversation_id))];
  if (!conversationIds.length) return [];
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content_type, text_content, file_url, shared_post_id, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });
  if (messageError) throw messageError;

  const messages = asMessages(messageData);
  const otherIds = participants
    .filter((participant) => participant.user_id !== authData.user.id)
    .map((participant) => participant.user_id);
  const profiles = await loadPublicProfiles([...new Set(otherIds)]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const latestMessageByConversation = new Map<string, DirectMessage>();
  messages.forEach((message) => {
    if (!latestMessageByConversation.has(message.conversation_id)) latestMessageByConversation.set(message.conversation_id, message);
  });

  return conversationIds
    .map((id): ConversationSummary | null => {
      const otherId = participants.find((participant) => participant.conversation_id === id && participant.user_id !== authData.user.id)?.user_id;
      if (!otherId) return null;
      const participant = profilesById.get(otherId);
      if (!participant) return null;
      return { id, participant, lastMessage: latestMessageByConversation.get(id) ?? null };
    })
    .filter((conversation): conversation is ConversationSummary => conversation !== null)
    .sort((first, second) => {
      const firstTime = first.lastMessage?.created_at ?? '';
      const secondTime = second.lastMessage?.created_at ?? '';
      return secondTime.localeCompare(firstTime);
    });
}

export async function loadConversationMessages(conversationId: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content_type, text_content, file_url, shared_post_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return asMessages(data);
}

export async function loadConversationParticipants(conversationId: string): Promise<PublicProfile[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId);
  if (error) throw error;
  const ids = ((data ?? []) as { user_id: string }[]).map((participant) => participant.user_id);
  return loadPublicProfiles(ids);
}

export async function sendTextMessage(conversationId: string, text: string): Promise<DirectMessage> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Введите сообщение.');
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы отправить сообщение.');
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: authData.user.id, content_type: 'text', text_content: trimmed,
  }).select('id, conversation_id, sender_id, content_type, text_content, file_url, shared_post_id, created_at').single();
  if (error) throw error;
  return data as DirectMessage;
}

export async function sendSharedPost(conversationId: string, postId: string): Promise<DirectMessage> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы отправить публикацию.');
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: authData.user.id, content_type: 'shared_post', shared_post_id: postId,
  }).select('id, conversation_id, sender_id, content_type, text_content, file_url, shared_post_id, created_at').single();
  if (error) throw error;
  return data as DirectMessage;
}

export async function uploadMessageFile(conversationId: string, file: File): Promise<DirectMessage> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы прикрепить файл.');
  const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
  const path = `${conversationId}/${authData.user.id}/${crypto.randomUUID()}${extension}`;
  const { error: uploadError } = await supabase.storage.from('message-media').upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { data, error: messageError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: authData.user.id,
    content_type: type,
    file_url: path,
  }).select('id, conversation_id, sender_id, content_type, text_content, file_url, shared_post_id, created_at').single();
  if (messageError) throw messageError;
  return data as DirectMessage;
}

export async function createMessageFileUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('message-media').createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export function subscribeToConversation(conversationId: string, onMessage: (message: DirectMessage) => void): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      onMessage(payload.new as DirectMessage);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
