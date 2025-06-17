<?php
$mailbox = '{sv16395.xserver.jp:993/imap/ssl/novalidate-cert}INBOX';
$username = 'maru@rebikele.com';
$password = 'ast0-ra1a'; // 後で入力

$inbox = imap_open($mailbox, $username, $password) or die('接続失敗: ' . imap_last_error());
$emails = imap_search($inbox, 'ALL');

if ($emails) {
    rsort($emails);
    foreach ($emails as $email_number) {
        $overview = imap_fetch_overview($inbox, $email_number, 0)[0];
        echo "<p><strong>件名:</strong> " . mb_decode_mimeheader($overview->subject ?? '') . "<br>";
        echo "<strong>差出人:</strong> " . ($overview->from ?? '') . "<br>";
        echo "<strong>日時:</strong> " . ($overview->date ?? '') . "</p><hr>";
    }
    } else {
    echo "メールが見つかりません。";
    }
    imap_close($inbox);
    ?>
