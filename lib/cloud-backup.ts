import { type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { firestore, firebaseStorage } from "@/lib/firebase";
import type { MadeVideoItem } from "@/types/video";
import type { ImageBundleWorkItem } from "@/types/work";

const getFileExtension = (uri: string, fallback: string) => {
  const cleanUri = uri.split("?")[0] ?? uri;
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? fallback;
};

const uploadLocalFile = async ({
  uri,
  storagePath,
  contentType
}: {
  uri: string;
  storagePath: string;
  contentType: string;
}) => {
  if (!firebaseStorage) {
    throw new Error("Firebase Storage가 설정되지 않았습니다.");
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const fileRef = ref(firebaseStorage, storagePath);
  await uploadBytes(fileRef, blob, { contentType });
  return getDownloadURL(fileRef);
};

export const backupMadeVideo = async ({
  user,
  video,
  enabled
}: {
  user: User | null;
  video: MadeVideoItem;
  enabled: boolean;
}) => {
  if (!enabled || !user || !firestore || !firebaseStorage) {
    return null;
  }

  const videoUrl = await uploadLocalFile({
    uri: video.uri,
    storagePath: `users/${user.uid}/videos/${video.id}.mp4`,
    contentType: "video/mp4"
  });
  const coverUrl = video.coverUri
    ? await uploadLocalFile({
        uri: video.coverUri,
        storagePath: `users/${user.uid}/video-covers/${video.id}.${getFileExtension(
          video.coverUri,
          "jpg"
        )}`,
        contentType: "image/jpeg"
      })
    : null;

  await setDoc(
    doc(firestore, "users", user.uid, "videos", video.id),
    {
      ...video,
      videoUrl,
      coverUrl,
      localUri: video.uri,
      localCoverUri: video.coverUri ?? null,
      backedUpAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return { videoUrl, coverUrl };
};

export const backupImageBundleWork = async ({
  user,
  work,
  enabled
}: {
  user: User | null;
  work: ImageBundleWorkItem;
  enabled: boolean;
}) => {
  if (!enabled || !user || !firestore || !firebaseStorage) {
    return null;
  }

  const imageUrls = await Promise.all(
    work.imageUris.map((uri, index) =>
      uploadLocalFile({
        uri,
        storagePath: `users/${user.uid}/image-works/${work.id}/${String(index + 1).padStart(
          2,
          "0"
        )}.${getFileExtension(uri, "jpg")}`,
        contentType: uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
      })
    )
  );

  await setDoc(
    doc(firestore, "users", user.uid, "imageWorks", work.id),
    {
      ...work,
      imageUrls,
      localImageUris: work.imageUris,
      localCoverUri: work.coverUri ?? null,
      backedUpAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return { imageUrls };
};
