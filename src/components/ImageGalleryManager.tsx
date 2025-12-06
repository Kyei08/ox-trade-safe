import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, Image as ImageIcon, ExternalLink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StorageFile {
  name: string;
  id?: string;
  created_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  } | null;
}

interface ImageGalleryManagerProps {
  userId: string;
}

const ImageGalleryManager = ({ userId }: ImageGalleryManagerProps) => {
  const [listingImages, setListingImages] = useState<StorageFile[]>([]);
  const [avatarImages, setAvatarImages] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
  }, [userId]);

  const fetchImages = async () => {
    try {
      setLoading(true);

      // Fetch listing images
      const { data: listingData, error: listingError } = await supabase.storage
        .from("listing-images")
        .list(userId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      if (listingError) throw listingError;
      setListingImages((listingData || []) as StorageFile[]);

      // Fetch avatar images
      const { data: avatarData, error: avatarError } = await supabase.storage
        .from("avatars")
        .list(userId, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

      if (avatarError) throw avatarError;
      setAvatarImages((avatarData || []) as StorageFile[]);
    } catch (error: any) {
      toast.error("Failed to load images");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (bucket: string, fileName: string) => {
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(`${userId}/${fileName}`);
    return publicUrl;
  };

  const handleDelete = async (bucket: string, fileName: string) => {
    const filePath = `${userId}/${fileName}`;
    setDeleting(filePath);

    try {
      const { error } = await supabase.storage.from(bucket).remove([filePath]);
      if (error) throw error;

      if (bucket === "listing-images") {
        setListingImages((prev) => prev.filter((f) => f.name !== fileName));
      } else {
        setAvatarImages((prev) => prev.filter((f) => f.name !== fileName));
      }

      toast.success("Image deleted");
    } catch (error: any) {
      toast.error("Failed to delete image");
      console.error(error);
    } finally {
      setDeleting(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSize = [...listingImages, ...avatarImages].reduce(
    (acc, file) => acc + (file.metadata?.size || 0),
    0
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Storage Overview
          </CardTitle>
          <CardDescription>Manage your uploaded images</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{listingImages.length}</p>
              <p className="text-sm text-muted-foreground">Listing Images</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{avatarImages.length}</p>
              <p className="text-sm text-muted-foreground">Avatars</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatSize(totalSize)}</p>
              <p className="text-sm text-muted-foreground">Total Size</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listing Images */}
      <Card>
        <CardHeader>
          <CardTitle>Listing Images</CardTitle>
          <CardDescription>
            Images uploaded for your listings ({listingImages.length} files)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listingImages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No listing images uploaded yet
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {listingImages.map((file) => (
                <div
                  key={file.id || file.name}
                  className="relative group rounded-lg overflow-hidden border bg-muted aspect-square"
                >
                  <img
                    src={getPublicUrl("listing-images", file.name)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <Badge variant="secondary" className="text-xs">
                      {formatSize(file.metadata?.size || 0)}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={() =>
                          window.open(getPublicUrl("listing-images", file.name), "_blank")
                        }
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8"
                            disabled={deleting === `${userId}/${file.name}`}
                          >
                            {deleting === `${userId}/${file.name}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the image. If it's used in a listing, 
                              the listing will no longer show this image.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete("listing-images", file.name)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Avatar Images */}
      <Card>
        <CardHeader>
          <CardTitle>Avatar Images</CardTitle>
          <CardDescription>
            Profile pictures ({avatarImages.length} files)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {avatarImages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No avatar images uploaded yet
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {avatarImages.map((file) => (
                <div
                  key={file.id || file.name}
                  className="relative group rounded-full overflow-hidden border bg-muted h-20 w-20"
                >
                  <img
                    src={getPublicUrl("avatars", file.name)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          disabled={deleting === `${userId}/${file.name}`}
                        >
                          {deleting === `${userId}/${file.name}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Avatar?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this avatar image.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete("avatars", file.name)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageGalleryManager;