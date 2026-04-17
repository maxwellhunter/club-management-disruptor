import SwiftUI
import UIKit

// MARK: - Shared response types

private struct CreateMemberResponse: Decodable {
    let inviteUrl: String?
    let emailSent: Bool?
    let message: String?
}

private struct ResendInviteResponse: Decodable {
    let inviteUrl: String?
    let emailSent: Bool?
    let message: String?
}

private struct StatusUpdateResponse: Decodable {
    let member: StatusMember
    struct StatusMember: Decodable { let id: String; let status: String }
}

// MARK: - Add Member Sheet

struct AddMemberSheet: View {
    let tiers: [MemberTier]
    let onSuccess: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var role: MemberRole = .member
    @State private var tierId: String = ""
    @State private var memberNumber = ""
    @State private var notes = ""
    @State private var sendInvite = true

    @State private var submitting = false
    @State private var errorMessage: String?

    // After-create success state
    @State private var createdInviteUrl: String?
    @State private var createdSummary: String?

    private var canSubmit: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lastName.trimmingCharacters(in: .whitespaces).isEmpty
            && email.contains("@")
            && !submitting
    }

    var body: some View {
        NavigationStack {
            Group {
                if let inviteUrl = createdInviteUrl {
                    inviteSuccessView(inviteUrl: inviteUrl)
                } else {
                    formView
                }
            }
            .background(Color.club.background)
            .navigationTitle(createdInviteUrl == nil ? "Add Member" : "Invite Ready")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { finish() }
                }
            }
        }
    }

    // MARK: - Form

    private var formView: some View {
        Form {
            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.destructive)
                }
            }

            Section("Name") {
                TextField("First name", text: $firstName)
                    .textContentType(.givenName)
                TextField("Last name", text: $lastName)
                    .textContentType(.familyName)
            }

            Section("Contact") {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                TextField("Phone (optional)", text: $phone)
                    .textContentType(.telephoneNumber)
                    .keyboardType(.phonePad)
            }

            Section("Membership") {
                Picker("Role", selection: $role) {
                    ForEach(MemberRole.allCases) { role in
                        Text(role.label).tag(role)
                    }
                }

                Picker("Tier", selection: $tierId) {
                    Text("No tier").tag("")
                    ForEach(tiers) { tier in
                        Text(tier.name).tag(tier.id)
                    }
                }

                TextField("Member number (optional)", text: $memberNumber)
                    .autocorrectionDisabled()
            }

            Section("Notes") {
                TextField("Notes (optional)", text: $notes, axis: .vertical)
                    .lineLimit(2...4)
            }

            Section {
                Toggle(isOn: $sendInvite) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Send invite link")
                            .font(.system(size: 15, weight: .medium))
                        Text("Member sets a password and activates their account")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
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
                            Image(systemName: sendInvite ? "paperplane.fill" : "person.fill.badge.plus")
                        }
                        Text(submitting ? "Creating…" : (sendInvite ? "Create & Invite" : "Create Member"))
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
    }

    // MARK: - Success state

    private func inviteSuccessView(inviteUrl: String) -> some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 52))
                .foregroundStyle(Color.club.primary)
                .padding(.top, 24)

            Text(createdSummary ?? "Member created")
                .font(.system(size: 15))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            VStack(alignment: .leading, spacing: 8) {
                Text("INVITE LINK")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(Color.club.onSurfaceVariant)

                Text(inviteUrl)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Color.club.foreground)
                    .textSelection(.enabled)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 10))
            }
            .padding(.horizontal, 20)

            HStack(spacing: 12) {
                Button {
                    UIPasteboard.general.string = inviteUrl
                } label: {
                    Label("Copy", systemImage: "doc.on.doc")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(Color.club.primary)
                        .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 12))
                }

                ShareLink(item: inviteUrl) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(.white)
                        .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(.horizontal, 20)

            Text("This link expires in 7 days.")
                .font(.system(size: 12))
                .foregroundStyle(Color.club.onSurfaceVariant)

            Spacer()

            Button {
                finish()
            } label: {
                Text("Done")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
    }

    // MARK: - Submit

    private func submit() async {
        submitting = true
        errorMessage = nil
        defer { submitting = false }

        struct CreateMemberRequest: Encodable {
            let firstName: String
            let lastName: String
            let email: String
            let phone: String?
            let role: String
            let membershipTierId: String?
            let memberNumber: String?
            let notes: String?
            let sendInvite: Bool
        }

        let body = CreateMemberRequest(
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            lastName: lastName.trimmingCharacters(in: .whitespaces),
            email: email.trimmingCharacters(in: .whitespaces),
            phone: phone.isEmpty ? nil : phone,
            role: role.rawValue,
            membershipTierId: tierId.isEmpty ? nil : tierId,
            memberNumber: memberNumber.isEmpty ? nil : memberNumber,
            notes: notes.isEmpty ? nil : notes,
            sendInvite: sendInvite
        )

        do {
            let response: CreateMemberResponse = try await APIClient.shared.post("/members", body: body)
            createdSummary = response.message ?? "Member created."
            if let url = response.inviteUrl {
                createdInviteUrl = url
            } else {
                finish()
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }

    private func finish() {
        onSuccess()
        dismiss()
    }
}

// MARK: - Member Detail Sheet (admin actions)

struct MemberDetailSheet: View {
    let member: DirectoryMember
    let onChange: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var currentStatus: String
    @State private var working: ActionKind?
    @State private var errorMessage: String?
    @State private var resendResult: String?
    @State private var confirmStatusChange: ProposedStatusChange?

    private enum ActionKind: Equatable { case resend, status(String) }

    private struct ProposedStatusChange: Identifiable {
        let target: String
        var id: String { target }
        var title: String {
            switch target {
            case "active": return "Reactivate member?"
            case "inactive": return "Deactivate member?"
            case "suspended": return "Suspend member?"
            default: return "Change status?"
            }
        }
        var message: String {
            switch target {
            case "inactive":
                return "They'll lose access to the app and bookings until reactivated."
            case "suspended":
                return "Account will be suspended. They keep their history but can't log in."
            case "active":
                return "They'll regain access to the app and bookings."
            default:
                return ""
            }
        }
    }

    init(member: DirectoryMember, onChange: @escaping () -> Void) {
        self.member = member
        self.onChange = onChange
        _currentStatus = State(initialValue: member.status ?? "active")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Member") {
                    LabeledContent("Name", value: member.fullName)
                    if let email = member.email { LabeledContent("Email", value: email) }
                    if let phone = member.phone { LabeledContent("Phone", value: phone) }
                    if let number = member.memberNumber { LabeledContent("Member #", value: number) }
                    if let tier = member.tierName { LabeledContent("Tier", value: tier) }
                    LabeledContent("Status", value: currentStatus.capitalized)
                    if let role = member.role, role != "member" {
                        LabeledContent("Role", value: role.capitalized)
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.destructive)
                    }
                }

                if let resendResult {
                    Section {
                        Label(resendResult, systemImage: "checkmark.circle.fill")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.primary)
                    }
                }

                // Invite actions (only for invited members)
                if currentStatus == "invited" {
                    Section("Invite") {
                        Button {
                            Task { await resendInvite() }
                        } label: {
                            HStack {
                                Image(systemName: "paperplane.fill")
                                Text("Resend invite")
                                Spacer()
                                if working == .resend {
                                    ProgressView()
                                }
                            }
                        }
                        .disabled(working != nil)
                    }
                }

                // Status actions
                Section("Status") {
                    if currentStatus != "active" {
                        statusRow("Activate", target: "active", icon: "checkmark.circle.fill", color: Color.club.primary)
                    }
                    if currentStatus != "inactive" {
                        statusRow("Deactivate", target: "inactive", icon: "pause.circle.fill", color: Color.club.onSurfaceVariant)
                    }
                    if currentStatus != "suspended" {
                        statusRow("Suspend", target: "suspended", icon: "exclamationmark.octagon.fill", color: Color.club.destructive)
                    }
                }

                if let phone = member.phone {
                    Section {
                        Button {
                            if let url = URL(string: "tel:\(phone.replacingOccurrences(of: " ", with: ""))") {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            Label("Call \(phone)", systemImage: "phone.fill")
                        }
                        if let email = member.email {
                            Button {
                                if let url = URL(string: "mailto:\(email)") {
                                    UIApplication.shared.open(url)
                                }
                            } label: {
                                Label("Email \(email)", systemImage: "envelope.fill")
                            }
                        }
                    }
                }
            }
            .navigationTitle(member.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                confirmStatusChange?.title ?? "",
                isPresented: Binding(
                    get: { confirmStatusChange != nil },
                    set: { if !$0 { confirmStatusChange = nil } }
                ),
                titleVisibility: .visible,
                presenting: confirmStatusChange
            ) { change in
                Button(change.target == "suspended" ? "Suspend" : (change.target == "inactive" ? "Deactivate" : "Confirm"),
                       role: change.target == "active" ? .none : .destructive) {
                    Task { await updateStatus(to: change.target) }
                }
                Button("Cancel", role: .cancel) { confirmStatusChange = nil }
            } message: { change in
                Text(change.message)
            }
        }
    }

    // MARK: - Status row

    private func statusRow(_ label: String, target: String, icon: String, color: Color) -> some View {
        Button {
            confirmStatusChange = ProposedStatusChange(target: target)
        } label: {
            HStack {
                Image(systemName: icon).foregroundStyle(color)
                Text(label).foregroundStyle(Color.club.foreground)
                Spacer()
                if working == .status(target) { ProgressView() }
            }
        }
        .disabled(working != nil)
    }

    // MARK: - Actions

    private func resendInvite() async {
        working = .resend
        errorMessage = nil
        resendResult = nil
        defer { working = nil }

        do {
            let response: ResendInviteResponse = try await APIClient.shared.post(
                "/members/\(member.id.uuidString.lowercased())/resend-invite"
            )
            resendResult = response.message ?? "Invite resent."
            onChange()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }

    private func updateStatus(to newStatus: String) async {
        working = .status(newStatus)
        errorMessage = nil
        defer { working = nil }

        struct StatusRequest: Encodable { let status: String }

        do {
            let response: StatusUpdateResponse = try await APIClient.shared.patch(
                "/members/\(member.id.uuidString.lowercased())/status",
                body: StatusRequest(status: newStatus)
            )
            currentStatus = response.member.status
            onChange()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }
}

