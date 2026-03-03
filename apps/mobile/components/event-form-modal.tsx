import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Colors } from "@/constants/theme";

interface EventData {
  id?: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  start_date?: string;
  end_date?: string | null;
  capacity?: number | null;
  price?: number | null;
  status?: string;
}

interface EventFormModalProps {
  visible: boolean;
  event?: EventData | null;
  apiUrl: string;
  headers: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventFormModal({
  visible,
  event,
  apiUrl,
  headers,
  onClose,
  onSaved,
}: EventFormModalProps) {
  const isEditing = !!event?.id;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startDate, setStartDate] = useState(
    toDateInputValue(event?.start_date)
  );
  const [startTime, setStartTime] = useState(
    toTimeInputValue(event?.start_date) || "18:00"
  );
  const [endDate, setEndDate] = useState(toDateInputValue(event?.end_date));
  const [endTime, setEndTime] = useState(
    toTimeInputValue(event?.end_date) || "22:00"
  );
  const [capacity, setCapacity] = useState(
    event?.capacity?.toString() ?? ""
  );
  const [price, setPrice] = useState(event?.price?.toString() ?? "");
  const [status, setStatus] = useState(event?.status ?? "draft");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartDate("");
    setStartTime("18:00");
    setEndDate("");
    setEndTime("22:00");
    setCapacity("");
    setPrice("");
    setStatus("draft");
  }

  // Sync form state when event prop changes (e.g., opening edit for a different event)
  useEffect(() => {
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setLocation(event?.location ?? "");
    setStartDate(toDateInputValue(event?.start_date));
    setStartTime(toTimeInputValue(event?.start_date) || "18:00");
    setEndDate(toDateInputValue(event?.end_date));
    setEndTime(toTimeInputValue(event?.end_date) || "22:00");
    setCapacity(event?.capacity?.toString() ?? "");
    setPrice(event?.price?.toString() ?? "");
    setStatus(event?.status ?? "draft");
  }, [event]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert("Validation", "Title is required");
      return;
    }
    if (!startDate) {
      Alert.alert("Validation", "Start date is required");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        start_date: new Date(`${startDate}T${startTime}:00`).toISOString(),
      };

      if (description.trim()) body.description = description.trim();
      if (location.trim()) body.location = location.trim();
      if (endDate) {
        body.end_date = new Date(`${endDate}T${endTime}:00`).toISOString();
      }
      if (capacity) body.capacity = parseInt(capacity, 10);
      if (price) body.price = parseFloat(price);
      if (isEditing) body.status = status;

      const url = isEditing
        ? `${apiUrl}/api/events/admin/${event!.id}`
        : `${apiUrl}/api/events/admin`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetForm();
        onSaved();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to save event");
      }
    } catch {
      Alert.alert("Error", "Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  const STATUS_OPTIONS = [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "cancelled", label: "Cancelled" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEditing ? "Edit Event" : "New Event"}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !title.trim() || !startDate}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  (!title.trim() || !startDate) && { opacity: 0.4 },
                ]}
              >
                {isEditing ? "Save" : "Create"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Spring Gala Dinner"
              placeholderTextColor={Colors.light.mutedForeground}
              maxLength={200}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the event..."
              placeholderTextColor={Colors.light.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Main Ballroom"
              placeholderTextColor={Colors.light.mutedForeground}
            />
          </View>

          {/* Start Date + Time */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>
                Start Date <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.light.mutedForeground}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Start Time</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
                placeholderTextColor={Colors.light.mutedForeground}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {/* End Date + Time */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>End Date</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.light.mutedForeground}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>End Time</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="HH:MM"
                placeholderTextColor={Colors.light.mutedForeground}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {/* Capacity + Price */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Capacity</Text>
              <TextInput
                style={styles.input}
                value={capacity}
                onChangeText={setCapacity}
                placeholder="Unlimited"
                placeholderTextColor={Colors.light.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Price ($)</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="Free"
                placeholderTextColor={Colors.light.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Status (edit mode only) */}
          {isEditing && (
            <View style={styles.field}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusChip,
                      status === opt.value && styles.statusChipActive,
                    ]}
                    onPress={() => setStatus(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        status === opt.value && styles.statusChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.light.mutedForeground,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.light.foreground,
    backgroundColor: Colors.light.background,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  statusChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.mutedForeground,
  },
  statusChipTextActive: {
    color: Colors.light.primaryForeground,
  },
});
