import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
}

interface ConversationData {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  listings: {
    title: string;
  };
  buyer_profile: {
    full_name: string;
  };
  seller_profile: {
    full_name: string;
  };
}

const Conversation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !id) return;

    const fetchConversation = async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          listings!inner(title)
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching conversation:", error);
        toast({
          title: "Error",
          description: "Failed to load conversation",
          variant: "destructive",
        });
        navigate("/messages");
        return;
      }

      // Fetch profiles separately
      const [buyerProfile, sellerProfile] = await Promise.all([
        supabase
          .from("public_profiles")
          .select("full_name")
          .eq("id", data.buyer_id)
          .single(),
        supabase
          .from("public_profiles")
          .select("full_name")
          .eq("id", data.seller_id)
          .single(),
      ]);

      setConversation({
        ...data,
        buyer_profile: buyerProfile.data || { full_name: "" },
        seller_profile: sellerProfile.data || { full_name: "" },
      } as ConversationData);
    };

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(data);
        // Mark messages as read
        const unreadMessages = data.filter(
          (msg) => !msg.is_read && msg.sender_id !== user.id
        );
        if (unreadMessages.length > 0) {
          await supabase
            .from("messages")
            .update({ is_read: true })
            .in(
              "id",
              unreadMessages.map((msg) => msg.id)
            );
        }
      }
    };

    fetchConversation();
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`conversation-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
          // Mark as read if not from current user
          if (payload.new.sender_id !== user.id) {
            supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", payload.new.id)
              .then();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, navigate, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !id) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content: newMessage.trim(),
    });

    if (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } else {
      setNewMessage("");
      // Update conversation timestamp
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
    }
    setSending(false);
  };

  const getOtherUserName = () => {
    if (!conversation) return "";
    if (user?.id === conversation.buyer_id) {
      return conversation.seller_profile.full_name || "Seller";
    }
    return conversation.buyer_profile.full_name || "Buyer";
  };

  if (loading || !conversation) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="pt-20 px-4">
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="pt-20 flex-1 flex flex-col">
        <div className="border-b bg-background sticky top-16 z-10">
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/messages")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="w-10 h-10">
                <AvatarFallback>
                  {getOtherUserName()
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{getOtherUserName()}</p>
                <p className="text-sm text-muted-foreground">
                  {conversation.listings.title}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl mx-auto px-4 py-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender_id === user?.id ? "justify-end" : "justify-start"
                  }`}
                >
                  <Card
                    className={`max-w-[70%] p-3 ${
                      message.sender_id === user?.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="break-words">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.sender_id === user?.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatDistanceToNow(new Date(message.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </Card>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        <div className="border-t bg-background sticky bottom-0">
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="min-h-[60px] resize-none"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                size="icon"
                className="h-[60px] w-[60px]"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversation;