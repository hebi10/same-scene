const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const { onSchedule } = require("firebase-functions/v2/scheduler");

initializeApp();

const db = getFirestore();
const BACKUP_COLLECTIONS = ["photoBackups", "imageWorks", "videos"];
const DELETE_BATCH_SIZE = 450;

const deleteCollectionDocs = async (collectionRef) => {
  let deletedCount = 0;

  while (true) {
    const snapshot = await collectionRef.limit(DELETE_BATCH_SIZE).get();
    if (snapshot.empty) {
      return deletedCount;
    }

    const batch = db.batch();
    snapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
    await batch.commit();
    deletedCount += snapshot.size;
  }
};

const deleteUserBackup = async ({ userId, backupRef }) => {
  const bucket = getStorage().bucket();
  const storagePrefix = `users/${userId}/backups/`;
  const deleted = {
    photoBackups: 0,
    imageWorks: 0,
    videos: 0
  };

  await bucket.deleteFiles({ prefix: storagePrefix, force: true }).catch((error) => {
    logger.warn("Backup storage delete skipped or partially failed", {
      userId,
      storagePrefix,
      message: error instanceof Error ? error.message : String(error)
    });
  });

  const userRef = db.collection("users").doc(userId);
  for (const collectionName of BACKUP_COLLECTIONS) {
    deleted[collectionName] = await deleteCollectionDocs(userRef.collection(collectionName));
  }

  await backupRef.set(
    {
      status: "deleted",
      photoCount: 0,
      imageBundleCount: 0,
      videoCount: 0,
      imageBundles: FieldValue.delete(),
      videos: FieldValue.delete(),
      settings: FieldValue.delete(),
      deletedAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return deleted;
};

exports.cleanupExpiredBackups = onSchedule(
  {
    schedule: "every day 04:20",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB"
  },
  async () => {
    const now = new Date().toISOString();
    const snapshot = await db
      .collectionGroup("backups")
      .where("deleteAfter", "<=", now)
      .get();

    let checkedCount = 0;
    let deletedUserCount = 0;
    const results = [];

    for (const backupDoc of snapshot.docs) {
      checkedCount += 1;

      if (backupDoc.id !== "current") {
        continue;
      }

      const userRef = backupDoc.ref.parent.parent;
      if (!userRef) {
        continue;
      }

      const data = backupDoc.data();
      if (data.status === "deleted") {
        continue;
      }

      const deleted = await deleteUserBackup({
        userId: userRef.id,
        backupRef: backupDoc.ref
      });
      deletedUserCount += 1;
      results.push({ userId: userRef.id, deleted });
    }

    logger.info("Expired backup cleanup completed", {
      checkedCount,
      deletedUserCount,
      results
    });
  }
);
