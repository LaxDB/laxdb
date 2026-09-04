CREATE TABLE `__new_invitation` (
  `id` text PRIMARY KEY,
  `organization_id` text NOT NULL REFERENCES `organization`(`id`) ON DELETE cascade,
  `email` text NOT NULL,
  `role` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `expires_at` integer NOT NULL,
  `inviter_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_invitation` (`id`, `organization_id`, `email`, `role`, `status`, `expires_at`, `inviter_id`, `created_at`)
SELECT `id`, `organization_id`, `email`, `role`, `status`, `expires_at`, `inviter_id`, cast(unixepoch('subsecond') * 1000 as integer)
FROM `invitation`;
--> statement-breakpoint
DROP TABLE `invitation`;
--> statement-breakpoint
ALTER TABLE `__new_invitation` RENAME TO `invitation`;
--> statement-breakpoint
CREATE INDEX `invitation_org_idx` ON `invitation` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);
