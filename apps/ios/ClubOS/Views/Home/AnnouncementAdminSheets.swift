import SwiftUI

// MARK: - Announcement Composer (create / edit)

struct AnnouncementComposerSheet: View {
    let existing: AnnouncementDetail?
    let tiers: [AnnouncementTier]
    let onSuccess: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var content: String
    @State private var priority: AnnouncementPriority
    @State private var targetedTierIds: Set<String>
    @State private var allTiers: Bool

    @State private var submitting = false
    @State private var errorMessage: String?
    @State private var publishChoice: PublishChoice = .saveDraft

    private enum PublishChoice { case saveDraft, publishNow }

    init(existing: AnnouncementDetail?, tiers: [AnnouncementTier], onSuccess: @escaping () -> Void) {
        self.existing = existing
        self.tiers = tiers
        self.onSuccess = onSuccess

        _title = State(initialValue: existing?.title ?? "")
        _content = State(initialValue: existing?.content ?? "")
        _priority = State(initialValue: existing?.priority ?? .normal)

        let tierIds = existing?.targetTierIds?.map { $0.uuidString.lowercased() } ?? []
        _targetedTierIds = State(initialValue: Set(tierIds))
        _allTiers = State(initialValue: tierIds.isEmpty)
    }

    private var canSubmit: Bool {
        !submitting
            && !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !content.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var isEditing: Bool { existing != nil }
    private var isAlreadyPublished: Bool { existing?.publishedAt != nil }

    var body: some View {
        NavigationStack {
            Form {
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.destructive)
                    }
                }

                Section("Content") {
                    TextField("Title", text: $title)
                        .font(.system(size: 16, weight: .semibold))
                    TextField("Body", text: $content, axis: .vertical)
                        .lineLimit(4...12)
                }

                Section("Priority") {
                    Picker("Priority", selection: $priority) {
                        ForEach(AnnouncementPriority.allCases) { p in
                            HStack {
                                Circle().fill(p.color).frame(width: 10, height: 10)
                                Text(p.label)
                            }
                            .tag(p)
                        }
                    }
                    .pickerStyle(.menu)
                }

                Section {
                    Toggle(isOn: $allTiers) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("All members")
                                .font(.system(size: 15, weight: .medium))
                            Text("Uncheck to target specific tiers")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                    }

                    if !allTiers {
                        ForEach(tiers) { tier in
                            Button {
                                toggleTier(tier.id)
                            } label: {
                                HStack {
                                    Image(systemName: targetedTierIds.contains(tier.id)
                                          ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(targetedTierIds.contains(tier.id)
                                                         ? Color.club.primary
                                                         : Color.club.outline)
                                    Text(tier.name)
                                        .foregroundStyle(Color.club.foreground)
                                    if let level = tier.level {
                                        Text(level.uppercased())
                                            .font(.system(size: 9, weight: .bold))
                                            .tracking(0.5)
                                            .foregroundStyle(Color.club.onSurfaceVariant)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.club.surfaceContainerHigh, in: Capsule())
                                    }
                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } header: {
                    Text("Audience")
                } footer: {
                    if !allTiers {
                        Text("Email blast and visibility are restricted to the selected tiers.")
                            .font(.system(size: 11))
                    }
                }

                if !isEditing || !isAlreadyPublished {
                    Section {
                        Picker("Publish", selection: $publishChoice) {
                            Text("Save as draft").tag(PublishChoice.saveDraft)
                            Text("Publish now").tag(PublishChoice.publishNow)
                        }
                        .pickerStyle(.segmented)
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    } footer: {
                        Text(publishChoice == .publishNow
                             ? "Publishing now sends an email blast to the targeted audience."
                             : "You can publish the draft later from the detail view.")
                            .font(.system(size: 11))
                    }
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            if submitting {
                                ProgressView().tint(.white)
                            } else {
                                Image(systemName: isEditing ? "checkmark" : (publishChoice == .publishNow ? "paperplane.fill" : "square.and.arrow.down"))
                            }
                            Text(buttonLabel)
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .foregroundStyle(.white)
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(canSubmit ? Color.club.primary : Color.club.primary.opacity(0.5))
                    .disabled(!canSubmit)
                }
            }
            .navigationTitle(isEditing ? "Edit Announcement" : "New Announcement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var buttonLabel: String {
        if submitting { return "Saving…" }
        if isEditing { return "Save Changes" }
        return publishChoice == .publishNow ? "Publish Now" : "Save Draft"
    }

    private func toggleTier(_ id: String) {
        if targetedTierIds.contains(id) {
            targetedTierIds.remove(id)
        } else {
            targetedTierIds.insert(id)
        }
    }

    // MARK: - Submit

    private func submit() async {
        submitting = true
        errorMessage = nil
        defer { submitting = false }

        let tierIds: [String]? = allTiers ? nil : Array(targetedTierIds)

        do {
            if let existing {
                try await patchExisting(id: existing.id, tierIds: tierIds)
            } else {
                try await createNew(tierIds: tierIds)
            }
            onSuccess()
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }

    private func createNew(tierIds: [String]?) async throws {
        struct CreateBody: Encodable {
            let title: String
            let content: String
            let priority: AnnouncementPriority
            let targetTierIds: [String]?
            let publish: Bool
        }
        struct CreateResponse: Decodable { let announcement: AnnouncementDetail }

        let body = CreateBody(
            title: title.trimmingCharacters(in: .whitespaces),
            content: content.trimmingCharacters(in: .whitespaces),
            priority: priority,
            targetTierIds: tierIds,
            publish: publishChoice == .publishNow
        )
        let _: CreateResponse = try await APIClient.shared.post("/announcements", body: body)
    }

    private func patchExisting(id: UUID, tierIds: [String]?) async throws {
        struct UpdateBody: Encodable {
            let title: String
            let content: String
            let priority: AnnouncementPriority
            let targetTierIds: [String]?
        }
        struct UpdateResponse: Decodable { let announcement: AnnouncementDetail }

        let body = UpdateBody(
            title: title.trimmingCharacters(in: .whitespaces),
            content: content.trimmingCharacters(in: .whitespaces),
            priority: priority,
            targetTierIds: tierIds
        )
        let _: UpdateResponse = try await APIClient.shared.patch(
            "/announcements/\(id.uuidString.lowercased())",
            body: body
        )
    }
}

// MARK: - Announcement Detail Sheet (admin actions)

struct AnnouncementDetailSheet: View {
    let announcement: AnnouncementDetail
    let tiers: [AnnouncementTier]
    let onChange: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var showEditor = false
    @State private var working: ActionKind?
    @State private var errorMessage: String?
    @State private var confirmDelete = false

    private enum ActionKind: Equatable { case publish, unpublish, delete }

    private var targetedTierNames: [String] {
        guard let ids = announcement.targetTierIds, !ids.isEmpty else { return [] }
        let set = Set(ids.map { $0.uuidString.lowercased() })
        return tiers.filter { set.contains($0.id.lowercased()) }.map(\.name)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        priorityBadge(announcement.priority)
                        Spacer()
                        Text(announcement.isPublished ? "Published" : "Draft")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(0.5)
                            .foregroundStyle(announcement.isPublished ? Color.club.primary : Color(hex: "6b7280"))
                    }

                    Text(announcement.title)
                        .font(.custom("Georgia", size: 20).weight(.bold))
                        .foregroundStyle(Color.club.foreground)

                    Text(announcement.content)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineSpacing(3)
                }

                Section("Audience") {
                    if targetedTierNames.isEmpty {
                        Label("All members", systemImage: "person.3.fill")
                    } else {
                        ForEach(targetedTierNames, id: \.self) { name in
                            Label(name, systemImage: "target")
                        }
                    }
                }

                if let createdAt = announcement.createdAt {
                    Section("Metadata") {
                        LabeledContent("Created") {
                            Text(DateUtilities.relativeTimeString(from: createdAt))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                        if let publishedAt = announcement.publishedAt {
                            LabeledContent("Published") {
                                Text(DateUtilities.relativeTimeString(from: publishedAt))
                                    .foregroundStyle(Color.club.onSurfaceVariant)
                            }
                        }
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.destructive)
                    }
                }

                Section("Actions") {
                    Button {
                        showEditor = true
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    .disabled(working != nil)

                    if announcement.isPublished {
                        Button {
                            Task { await performAction(.unpublish) }
                        } label: {
                            HStack {
                                Label("Revert to draft", systemImage: "arrow.uturn.backward")
                                Spacer()
                                if working == .unpublish { ProgressView() }
                            }
                        }
                        .disabled(working != nil)
                    } else {
                        Button {
                            Task { await performAction(.publish) }
                        } label: {
                            HStack {
                                Label("Publish now", systemImage: "paperplane.fill")
                                    .foregroundStyle(Color.club.primary)
                                Spacer()
                                if working == .publish { ProgressView() }
                            }
                        }
                        .disabled(working != nil)
                    }

                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        HStack {
                            Label("Delete", systemImage: "trash")
                            Spacer()
                            if working == .delete { ProgressView() }
                        }
                    }
                    .disabled(working != nil)
                }
            }
            .navigationTitle("Announcement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showEditor) {
                AnnouncementComposerSheet(existing: announcement, tiers: tiers) {
                    onChange()
                    dismiss()
                }
            }
            .confirmationDialog(
                "Delete this announcement?",
                isPresented: $confirmDelete,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    Task { await performAction(.delete) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(announcement.isPublished
                     ? "It will disappear from all member feeds."
                     : "This draft will be removed.")
            }
        }
    }

    private func priorityBadge(_ priority: AnnouncementPriority) -> some View {
        return HStack(spacing: 6) {
            Circle().fill(priority.color).frame(width: 6, height: 6)
            Text(priority.label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(priority.color)
        }
    }

    private func performAction(_ kind: ActionKind) async {
        working = kind
        errorMessage = nil
        defer { working = nil }

        do {
            switch kind {
            case .publish:
                try await sendAction("publish")
                onChange()
                dismiss()
            case .unpublish:
                try await sendAction("unpublish")
                onChange()
                dismiss()
            case .delete:
                try await APIClient.shared.delete("/announcements/\(announcement.id.uuidString.lowercased())")
                onChange()
                dismiss()
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }

    private func sendAction(_ action: String) async throws {
        struct ActionBody: Encodable { let action: String }
        struct ActionResponse: Decodable { let announcement: AnnouncementDetail }

        let _: ActionResponse = try await APIClient.shared.patch(
            "/announcements/\(announcement.id.uuidString.lowercased())",
            body: ActionBody(action: action)
        )
    }
}
