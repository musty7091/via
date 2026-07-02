"""showcase artists

Revision ID: 4d8c213b1b56
Revises: 570ba6474496
Create Date: 2026-06-30 15:29:20.991771

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4d8c213b1b56'
down_revision: Union[str, None] = '570ba6474496'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: Tablo daha önce (create_all mirası) oluşmuşsa yeniden
    # oluşturmayı ATLA; yalnızca Alembic sürümü ilerlesin. Aksi hâlde
    # "table already exists" hatasıyla başlatma çöker.
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "showcase_artists" in inspector.get_table_names():
        return

    op.create_table(
        'showcase_artists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('tagline', sa.String(length=300), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=1000), nullable=True),
        sa.Column('video_url', sa.String(length=1000), nullable=True),
        sa.Column('instagram_url', sa.String(length=500), nullable=True),
        sa.Column('youtube_url', sa.String(length=500), nullable=True),
        sa.Column('spotify_url', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_showcase_artists_category', 'showcase_artists', ['category'])
    op.create_index('ix_showcase_artists_id', 'showcase_artists', ['id'])
    op.create_index('ix_showcase_artists_is_active', 'showcase_artists', ['is_active'])


def downgrade() -> None:
    op.drop_table('showcase_artists')
