import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string;
  listings: {
    title: string;
    images: string[];
  };
  buyer_profile: {
    full_name: string;
  };
  seller_profile: {
    full_name: string;
  };
  messages: Array<{
    content: string;
    created_at: string;
    is_read: boolean;
    sender_id: string;
  }>;
}

const Messages = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          listings!inner(title, images),
          messages(content, created_at, is_read, sender_id)
        `)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching conversations:", error);
        toast({
          title: "Error",
          description: "Failed to load conversations",
          variant: "destructive",
        });
        setLoadingConversations(false);
        return;
      }

      // Fetch profiles separately
      const conversationsWithProfiles = await Promise.all(
        (data || []).map(async (conv) => {
          const [buyerProfile, sellerProfile] = await Promise.all([
            supabase
              .from("public_profiles")
              .select("full_name")
              .eq("id", conv.buyer_id)
              .single(),
            supabase
              .from("public_profiles")
              .select("full_name")
              .eq("id", conv.seller_id)
              .single(),
          ]);

          return {
            ...conv,
            buyer_profile: buyerProfile.data || { full_name: "" },
            seller_profile: sellerProfile.data || { full_name: "" },
          };
        })
      );

      setConversations(conversationsWithProfiles as Conversation[]);
      setLoadingConversations(false);
    };

    fetchConversations();

    // Subscribe to conversation updates
    const channel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const getOtherUserName = (conversation: Conversation) => {
    if (user?.id === conversation.buyer_id) {
      return conversation.seller_profile.full_name || "Seller";
    }
    return conversation.buyer_profile.full_name || "Buyer";
  };

  const getLastMessage = (conversation: Conversation) => {
    if (conversation.messages && conversation.messages.length > 0) {
      const lastMsg = conversation.messages[conversation.messages.length - 1];
      return lastMsg.content;
    }
    return "No messages yet";
  };

  const getUnreadCount = (conversation: Conversation) => {
    if (!conversation.messages) return 0;
    return conversation.messages.filter(
      (msg) => !msg.is_read && msg.sender_id !== user?.id
    ).length;
  };

  if (loading || loadingConversations) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="pt-20 px-4">
          <div className="container max-w-4xl mx-auto">
            <p className="text-center text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="pt-20 px-4 pb-8">
        <div className="container max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Messages</h1>

          {conversations.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Start a conversation by contacting a seller on a listing
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <Card
                  key={conversation.id}
                  className="p-4 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback>
                        {getOtherUserName(conversation)
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="font-semibold">
                            {getOtherUserName(conversation)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {conversation.listings.title}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conversation.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {getLastMessage(conversation)}
                        </p>
                        {getUnreadCount(conversation) > 0 && (
                          <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full ml-2">
                            {getUnreadCount(conversation)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;