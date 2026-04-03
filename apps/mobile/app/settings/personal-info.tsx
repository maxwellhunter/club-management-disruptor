import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

interface MemberProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  member_number: string | null;
}

export default function PersonalInfoScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("members")
        .select("first_name, last_name, email, phone, member_number")
        .eq("user_id", user?.id)
        .single();

      if (data) {
        setProfile(data as MemberProfile);
        setForm({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || "",
        });
      }
    } catch {
      Alert.alert("Error", "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim() || null,
        })
        .eq("user_id", user?.id);

      if (error) throw error;
      Alert.alert("Updated", "Your profile has been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.light.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personal Information</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Read-only fields */}
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <Text style={styles.readOnly}>{profile?.email}</Text>
            <Text style={styles.hint}>Contact an administrator to change your email</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.label}>MEMBER NUMBER</Text>
            <Text style={styles.readOnly}>{profile?.member_number || "—"}</Text>
          </View>
        </View>

        {/* Editable fields */}
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>FIRST NAME</Text>
            <TextInput
              style={styles.input}
              value={form.first_name}
              onChangeText={(v) => setForm({ ...form, first_name: v })}
              placeholder="First name"
              placeholderTextColor={Colors.light.outline}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.label}>LAST NAME</Text>
            <TextInput
              style={styles.input}
              value={form.last_name}
              onChangeText={(v) => setForm({ ...form, last_name: v })}
              placeholder="Last name"
              placeholderTextColor={Colors.light.outline}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.label}>PHONE</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
              placeholder="(555) 000-0000"
              placeholderTextColor={Colors.light.outline}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  card: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  field: { paddingVertical: 8 },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.outline,
    marginBottom: 6,
  },
  readOnly: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
  },
  hint: {
    fontSize: 11,
    color: Colors.light.outline,
    marginTop: 4,
  },
  input: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.foreground,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginVertical: 4,
  },
  saveButton: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
  },
});
