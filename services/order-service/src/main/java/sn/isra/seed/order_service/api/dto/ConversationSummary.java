package sn.isra.seed.order_service.api.dto;

import java.time.LocalDateTime;

public record ConversationSummary(
    Long id,
    String autreParticipant,
    String autreParticipantNom,
    String autreParticipantRole,
    String autreParticipantOrg,
    String dernierMessage,
    String dernierMessageType,
    LocalDateTime dernierMessageAt,
    long nonLus
) {}
