import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  base64?: string;
  fileName?: string;
}

/** Request camera permissions */
async function ensureCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Camera Access Required",
      "Please enable camera access in Settings to take a photo."
    );
    return false;
  }
  return true;
}

/** Request media library permissions */
async function ensureMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Photo Library Access Required",
      "Please enable photo library access in Settings to choose a photo."
    );
    return false;
  }
  return true;
}

/** Pick an image from the device's photo library */
export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const hasPermission = await ensureMediaLibraryPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? undefined,
  };
}

/** Take a photo with the camera */
export async function takePhoto(): Promise<PickedImage | null> {
  const hasPermission = await ensureCameraPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? undefined,
  };
}

/** Show an action sheet to choose between camera and library */
export function showImagePickerOptions(
  onPick: (image: PickedImage) => void
): void {
  Alert.alert("Update Photo", "Choose a source for your profile photo", [
    {
      text: "Take Photo",
      onPress: async () => {
        const image = await takePhoto();
        if (image) onPick(image);
      },
    },
    {
      text: "Choose from Library",
      onPress: async () => {
        const image = await pickImageFromLibrary();
        if (image) onPick(image);
      },
    },
    { text: "Cancel", style: "cancel" },
  ]);
}
