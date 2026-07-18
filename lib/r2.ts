import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2 = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME!

export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}

export async function deleteFromR2(key: string) {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  )
}

export async function getR2PresignedUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  })
  return getSignedUrl(r2, command, { expiresIn })
}

export async function getR2ObjectBytes(key: string): Promise<{
  bytes: Uint8Array
  contentType: string
}> {
  const res = await r2.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  )
  const bytes = await res.Body!.transformToByteArray()
  return {
    bytes,
    contentType: res.ContentType || 'application/octet-stream',
  }
}
