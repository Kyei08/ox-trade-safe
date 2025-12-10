import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Facebook, Instagram, Twitter, Linkedin, MessageCircle, Video, Youtube, Globe } from "lucide-react";

const southAfricanProvinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const urlSchema = z.string().trim().url("Please enter a valid URL").or(z.literal("")).optional();

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^(\+27|0)[6-8][0-9]{8}$/, "Enter a valid South African phone number (e.g., +27812345678 or 0812345678)")
    .optional()
    .or(z.literal("")),
  location: z.string().trim().max(100).optional().or(z.literal("")),
  bio: z.string().trim().max(500, "Bio must be less than 500 characters").optional().or(z.literal("")),
  facebook_url: urlSchema,
  instagram_url: urlSchema,
  twitter_url: urlSchema,
  linkedin_url: urlSchema,
  whatsapp_number: z.string().trim().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Please enter a valid South African mobile number").or(z.literal("")).optional(),
  tiktok_url: urlSchema,
  youtube_url: urlSchema,
  website_url: urlSchema,
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileEditDialogProps {
  userId: string;
  currentProfile: {
    full_name: string | null;
    phone: string | null;
    location?: string | null;
    bio: string | null;
    facebook_url?: string | null;
    instagram_url?: string | null;
    twitter_url?: string | null;
    linkedin_url?: string | null;
    whatsapp_number?: string | null;
    tiktok_url?: string | null;
    youtube_url?: string | null;
    website_url?: string | null;
  };
  onProfileUpdate: () => void;
  children: React.ReactNode;
}

const ProfileEditDialog = ({ userId, currentProfile, onProfileUpdate, children }: ProfileEditDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: currentProfile.full_name || "",
      phone: currentProfile.phone || "",
      location: currentProfile.location || "",
      bio: currentProfile.bio || "",
      facebook_url: currentProfile.facebook_url || "",
      instagram_url: currentProfile.instagram_url || "",
      twitter_url: currentProfile.twitter_url || "",
      linkedin_url: currentProfile.linkedin_url || "",
      whatsapp_number: currentProfile.whatsapp_number || "",
      tiktok_url: currentProfile.tiktok_url || "",
      youtube_url: currentProfile.youtube_url || "",
      website_url: currentProfile.website_url || "",
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          phone: values.phone || null,
          location: values.location || null,
          bio: values.bio || null,
          facebook_url: values.facebook_url || null,
          instagram_url: values.instagram_url || null,
          twitter_url: values.twitter_url || null,
          linkedin_url: values.linkedin_url || null,
          whatsapp_number: values.whatsapp_number || null,
          tiktok_url: values.tiktok_url || null,
          youtube_url: values.youtube_url || null,
          website_url: values.website_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Profile updated successfully");
      setOpen(false);
      onProfileUpdate();
    } catch (error: any) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your personal information. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+27812345678 or 0812345678" {...field} />
                  </FormControl>
                  <FormDescription>
                    South African phone number format
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Province)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your province" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {southAfricanProvinces.map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about yourself..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0}/500 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Social Media Links */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-medium text-muted-foreground">Social Media Links</h4>
              
              <FormField
                control={form.control}
                name="facebook_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Facebook className="h-4 w-4 text-[#1877F2]" />
                      Facebook
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://facebook.com/yourprofile" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instagram_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Instagram className="h-4 w-4 text-[#E4405F]" />
                      Instagram
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://instagram.com/yourprofile" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="twitter_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Twitter className="h-4 w-4 text-[#1DA1F2]" />
                      X (Twitter)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://x.com/yourprofile" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedin_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                      LinkedIn
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://linkedin.com/in/yourprofile" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-[#25D366]" />
                      WhatsApp Number
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="+27812345678 or 0812345678" {...field} />
                    </FormControl>
                    <FormDescription>
                      South African mobile number for WhatsApp contact
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tiktok_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-foreground" />
                      TikTok
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://tiktok.com/@yourprofile" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="youtube_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-[#FF0000]" />
                      YouTube
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/@yourchannel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Website
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://yourwebsite.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditDialog;
