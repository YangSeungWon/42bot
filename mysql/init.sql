CREATE TABLE IF NOT EXISTS restaurants (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    count INT UNSIGNED NOT NULL,
    score FLOAT NOT NULL,
    lastOrder TIMESTAMP
);



SET collation_connection = 'utf8_general_ci';
ALTER DATABASE app CHARACTER SET utf8 COLLATE utf8_general_ci;
ALTER TABLE restaurants CONVERT TO CHARACTER SET utf8 COLLATE utf8_general_ci;
