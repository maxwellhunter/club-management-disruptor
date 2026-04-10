import SwiftUI

// MARK: - Chat Models

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: String  // "user" or "assistant"
    let content: String
    let attachments: [ChatAttachment]

    init(role: String, content: String, attachments: [ChatAttachment] = []) {
        self.role = role
        self.content = content
        self.attachments = attachments
    }
}

// Attachment types from the API
enum ChatAttachment {
    case eventList([ChatEventItem])
    case teeTimeList([ChatTeeTimeItem])
    case bookingConfirm(ChatBookingItem)
    case myBookings([ChatBookingItem])
}

struct ChatEventItem: Decodable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let location: String?
    let startDate: String
    let endDate: String?
    let capacity: Int?
    let price: FlexibleDouble?
    let rsvpCount: Int
    let userRsvpStatus: String?

    var priceValue: Double? { price?.value }
}

struct ChatTeeTimeItem: Decodable, Identifiable {
    var id: String { "\(facilityId)-\(date)-\(startTime)" }
    let facilityId: String
    let facilityName: String
    let date: String
    let dayLabel: String
    let startTime: String
    let endTime: String
}

struct ChatBookingItem: Decodable, Identifiable {
    let id: String
    let facilityName: String
    let date: String
    let dayLabel: String
    let startTime: String
    let endTime: String
    let partySize: Int
    let status: String
}

// Raw API response
private struct ChatAPIResponse: Decodable {
    let message: String
    let attachments: [RawAttachment]?

    struct RawAttachment: Decodable {
        let type: String
        let events: [ChatEventItem]?
        let slots: [ChatTeeTimeItem]?
        let booking: ChatBookingItem?
        let bookings: [ChatBookingItem]?
    }
}

// MARK: - Quick Actions

private struct QuickAction {
    let label: String
    let icon: String
    let prompt: String
}

private let quickActions = [
    QuickAction(label: "Book Golf", icon: "figure.golf", prompt: "What tee times are available this weekend?"),
    QuickAction(label: "Events", icon: "calendar.badge.clock", prompt: "What events are coming up?"),
    QuickAction(label: "Dining", icon: "fork.knife", prompt: "Make a dinner reservation for Saturday"),
    QuickAction(label: "My Account", icon: "person.text.rectangle", prompt: "What's my membership status?"),
]

// MARK: - Chat View

struct ChatView: View {
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var scrollProxy: ScrollViewProxy?
    @FocusState private var inputFocused: Bool

    var body: some View {
        ZStack {
            Color.club.background.ignoresSafeArea()

            VStack(spacing: 0) {
                if messages.isEmpty {
                    emptyStateView
                } else {
                    messageListView
                }

                inputBar
            }
        }
        .navigationTitle("AI Concierge")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if !messages.isEmpty {
                    Button {
                        withAnimation { messages = [] }
                    } label: {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                }
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Empty State
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var emptyStateView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 28) {
                Spacer(minLength: 40)

                // AI avatar
                ZStack {
                    Circle()
                        .fill(Color.club.accent)
                        .frame(width: 80, height: 80)
                    Image(systemName: "sparkles")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.club.primary)
                }

                VStack(spacing: 8) {
                    Text("ClubOS Concierge")
                        .font(.custom("Georgia", size: 24).weight(.bold))
                        .foregroundStyle(Color.club.foreground)

                    Text("Your AI-powered club assistant. Ask about events, bookings, dining, and more.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }

                // Quick action chips
                VStack(spacing: 10) {
                    ForEach(Array(quickActions.enumerated()), id: \.offset) { _, action in
                        Button {
                            sendMessage(action.prompt)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: action.icon)
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.club.primary)
                                    .frame(width: 24)

                                Text(action.label)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(Color.club.foreground)

                                Spacer()

                                Image(systemName: "arrow.up.right")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.club.outline)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)

                Spacer(minLength: 20)
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Message List
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var messageListView: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 16) {
                    ForEach(messages) { message in
                        messageBubble(message)
                            .id(message.id)
                    }

                    if isLoading {
                        typingIndicator
                            .id("typing")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .onChange(of: messages.count) { _, _ in
                scrollToBottom(proxy)
            }
            .onChange(of: isLoading) { _, _ in
                scrollToBottom(proxy)
            }
            .onAppear { scrollProxy = proxy }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.easeOut(duration: 0.3)) {
                if isLoading {
                    proxy.scrollTo("typing", anchor: .bottom)
                } else if let last = messages.last {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
        }
    }

    private func messageBubble(_ message: ChatMessage) -> some View {
        let isUser = message.role == "user"

        return VStack(alignment: isUser ? .trailing : .leading, spacing: 6) {
            if !isUser {
                // AI label
                HStack(spacing: 5) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.club.primary)
                    Text("ClubOS AI")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.club.outline)
                }
            }

            // Message content
            Text(attributedMarkdown(message.content))
                .font(.system(size: 15))
                .foregroundStyle(isUser ? .white : Color.club.foreground)
                .lineSpacing(3)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    isUser ? Color.club.primary : Color.club.surfaceContainerLowest,
                    in: ChatBubbleShape(isUser: isUser)
                )
                .shadow(color: Color.club.foreground.opacity(isUser ? 0 : 0.04), radius: 6, y: 2)

            // Attachments
            if !message.attachments.isEmpty {
                VStack(spacing: 8) {
                    ForEach(Array(message.attachments.enumerated()), id: \.offset) { _, attachment in
                        attachmentView(attachment)
                    }
                }
                .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    }

    private var typingIndicator: some View {
        HStack(spacing: 5) {
            Image(systemName: "sparkles")
                .font(.system(size: 10))
                .foregroundStyle(Color.club.primary)
            Text("ClubOS AI")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.club.outline)
            Spacer()
        }
        .overlay(alignment: .leading) {
            HStack(spacing: 4) {
                ForEach(0..<3) { i in
                    Circle()
                        .fill(Color.club.primary.opacity(0.5))
                        .frame(width: 6, height: 6)
                        .offset(y: typingBounce(i))
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(Color.club.surfaceContainerLowest, in: ChatBubbleShape(isUser: false))
            .offset(y: 24)
        }
        .padding(.bottom, 32)
    }

    private func typingBounce(_ index: Int) -> CGFloat {
        // Static bounce positions for simplicity
        let offsets: [CGFloat] = [-3, 0, -3]
        return offsets[index]
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Attachment Views
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @ViewBuilder
    private func attachmentView(_ attachment: ChatAttachment) -> some View {
        switch attachment {
        case .eventList(let events):
            VStack(spacing: 8) {
                ForEach(events) { event in
                    eventAttachmentCard(event)
                }
            }

        case .teeTimeList(let slots):
            VStack(spacing: 8) {
                ForEach(slots) { slot in
                    teeTimeAttachmentCard(slot)
                }
            }

        case .bookingConfirm(let booking):
            bookingConfirmCard(booking)

        case .myBookings(let bookings):
            VStack(spacing: 8) {
                ForEach(bookings) { booking in
                    bookingCard(booking)
                }
            }
        }
    }

    private func eventAttachmentCard(_ event: ChatEventItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 16))
                .foregroundStyle(Color.club.primary)
                .frame(width: 36, height: 36)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 3) {
                Text(event.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                    .lineLimit(1)

                Text(formatEventDate(event.startDate))
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)

                if let loc = event.location {
                    Text(loc)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.club.outline)
                }
            }

            Spacer()

            if event.userRsvpStatus == "attending" {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.club.primary)
            } else {
                let isFree = event.priceValue == nil || event.priceValue == 0
                Text(isFree ? "Free" : String(format: "$%.0f", event.priceValue ?? 0))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isFree ? Color.club.primary : Color.club.foreground)
            }
        }
        .padding(12)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.club.outlineVariant.opacity(0.2), lineWidth: 1)
        )
    }

    private func teeTimeAttachmentCard(_ slot: ChatTeeTimeItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "figure.golf")
                .font(.system(size: 16))
                .foregroundStyle(Color.club.primary)
                .frame(width: 36, height: 36)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 3) {
                Text(slot.facilityName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                    .lineLimit(1)
                Text("\(slot.dayLabel) · \(formatTeeTime(slot.startTime))")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Spacer()

            Text(formatTeeTime(slot.startTime))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.club.primary)
        }
        .padding(12)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.club.outlineVariant.opacity(0.2), lineWidth: 1)
        )
    }

    private func bookingConfirmCard(_ booking: ChatBookingItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(Color.club.primary)

            VStack(alignment: .leading, spacing: 3) {
                Text("Booking Confirmed")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.club.foreground)
                Text("\(booking.facilityName) · \(booking.dayLabel)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                Text("\(formatTeeTime(booking.startTime)) · Party of \(booking.partySize)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Spacer()
        }
        .padding(12)
        .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 12))
    }

    private func bookingCard(_ booking: ChatBookingItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "figure.golf")
                .font(.system(size: 14))
                .foregroundStyle(Color.club.primary)
                .frame(width: 32, height: 32)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(booking.facilityName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text("\(booking.dayLabel) · \(formatTeeTime(booking.startTime))")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Spacer()

            Text(booking.status.capitalized)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.club.primary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.club.accent, in: Capsule())
        }
        .padding(10)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.club.outlineVariant.opacity(0.2), lineWidth: 1)
        )
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Input Bar
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var inputBar: some View {
        VStack(spacing: 0) {
            Divider()

            HStack(spacing: 10) {
                TextField("Ask anything about the club...", text: $inputText, axis: .vertical)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.club.foreground)
                    .lineLimit(1...4)
                    .focused($inputFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 20))
                    .onSubmit { sendCurrentMessage() }

                Button(action: sendCurrentMessage) {
                    Group {
                        if isLoading {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 14, weight: .bold))
                        }
                    }
                    .frame(width: 36, height: 36)
                    .background(
                        canSend ? Color.club.primary : Color.club.surfaceContainerHigh,
                        in: Circle()
                    )
                    .foregroundStyle(canSend ? .white : Color.club.outline)
                }
                .disabled(!canSend)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(.ultraThinMaterial)
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Helpers
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func formatEventDate(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = fmt.date(from: iso)
        if date == nil {
            fmt.formatOptions = [.withInternetDateTime]
            date = fmt.date(from: iso)
        }
        guard let d = date else { return iso }
        let df = DateFormatter()
        df.dateFormat = "EEE, MMM d · h:mm a"
        return df.string(from: d)
    }

    private func formatTeeTime(_ time: String) -> String {
        let parts = time.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]), let min = Int(parts[1]) else { return time }
        let period = hour >= 12 ? "PM" : "AM"
        let h = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)
        return min == 0 ? "\(h) \(period)" : "\(h):\(String(format: "%02d", min)) \(period)"
    }

    private func attributedMarkdown(_ text: String) -> AttributedString {
        // Simple markdown: **bold**
        do {
            return try AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))
        } catch {
            return AttributedString(text)
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - API
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func sendCurrentMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }
        sendMessage(text)
    }

    private func sendMessage(_ text: String) {
        let userMsg = ChatMessage(role: "user", content: text)
        messages.append(userMsg)
        inputText = ""
        inputFocused = false
        isLoading = true

        Task {
            do {
                // Build messages array for API
                let apiMessages = messages.map { msg -> [String: String] in
                    ["role": msg.role, "content": msg.content]
                }

                struct ChatRequest: Encodable {
                    let messages: [[String: String]]
                }

                let request = try APIClient.shared.buildRequest(
                    path: "/chat",
                    method: "POST",
                    body: ChatRequest(messages: apiMessages)
                )

                let (data, response) = try await URLSession.shared.data(for: request)

                guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode < 400 else {
                    let errorMsg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["message"] as? String
                        ?? "Something went wrong. Please try again."
                    await MainActor.run {
                        messages.append(ChatMessage(role: "assistant", content: errorMsg))
                        isLoading = false
                    }
                    return
                }

                // Decode with snake_case conversion
                let decoder = JSONDecoder()
                decoder.keyDecodingStrategy = .convertFromSnakeCase
                let chatResponse = try decoder.decode(ChatAPIResponse.self, from: data)

                // Parse attachments
                var attachments: [ChatAttachment] = []
                for raw in chatResponse.attachments ?? [] {
                    switch raw.type {
                    case "event_list", "event_cancel":
                        if let events = raw.events, !events.isEmpty {
                            attachments.append(.eventList(events))
                        }
                    case "tee_time_list":
                        if let slots = raw.slots, !slots.isEmpty {
                            attachments.append(.teeTimeList(slots))
                        }
                    case "tee_time_booking_confirm":
                        if let booking = raw.booking {
                            attachments.append(.bookingConfirm(booking))
                        }
                    case "tee_time_my_bookings":
                        if let bookings = raw.bookings, !bookings.isEmpty {
                            attachments.append(.myBookings(bookings))
                        }
                    default:
                        break
                    }
                }

                await MainActor.run {
                    messages.append(ChatMessage(
                        role: "assistant",
                        content: chatResponse.message,
                        attachments: attachments
                    ))
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    messages.append(ChatMessage(role: "assistant", content: "Sorry, I couldn't connect to the server. Please check your connection and try again."))
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - Chat Bubble Shape

struct ChatBubbleShape: Shape {
    let isUser: Bool

    func path(in rect: CGRect) -> Path {
        let radius: CGFloat = 16
        let tailRadius: CGFloat = 4

        var path = Path()

        if isUser {
            // User: rounded corners, small tail bottom-right
            path.addRoundedRect(in: CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height),
                                cornerRadii: RectangleCornerRadii(topLeading: radius, bottomLeading: radius, bottomTrailing: tailRadius, topTrailing: radius))
        } else {
            // Assistant: rounded corners, small tail bottom-left
            path.addRoundedRect(in: CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height),
                                cornerRadii: RectangleCornerRadii(topLeading: radius, bottomLeading: tailRadius, bottomTrailing: radius, topTrailing: radius))
        }

        return path
    }
}
